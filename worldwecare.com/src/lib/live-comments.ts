/**
 * Live chat for a broadcast.
 *
 * FIVE THINGS THAT ARE NOT OBVIOUS FROM THE TYPES:
 *
 *  1. READING IS OPEN, WRITING IS NOT. A public broadcast can be
 *     watched by anyone with the link and no account — that is the
 *     whole premise of the stream — so the chat has to be readable on
 *     the same terms, or a signed-out viewer sees a locked box beside
 *     a stream they are allowed to watch. Posting needs an account,
 *     because an unattributable comment is unmoderatable.
 *
 *  2. WRITING STOPS WHEN THE STREAM DOES. Chat on an ended broadcast
 *     is a comments section, which is a different feature with
 *     different moderation. Reading stays open so a recording keeps
 *     the conversation that went with it.
 *
 *  3. REMOVAL IS A FLAG, NOT A DELETE. The broadcaster needs to clear
 *     abuse from their own stream mid-broadcast; an admin needs to see
 *     what was cleared afterwards. A hard delete serves the first and
 *     destroys the second.
 *
 *  4. THE RATE LIMIT IS COUNTED FROM THE TABLE. No in-memory Map: the
 *     site runs behind pm2 and a restart mid-broadcast would reset
 *     every limit at once, which is exactly when a flood is underway.
 *
 *  5. BLOCKS ARE APPLIED ON READ, NOT ON WRITE. Someone you blocked
 *     can still post — they simply do not appear to you. Refusing
 *     their write would tell them they are blocked.
 */

import { prisma } from "./db";
import { getMasker } from "./banned-words";
import { getBlockedIds } from "./blocks";
import { newerThan, parseCursor } from "./cursor";

export const MAX_BODY = 500;

/** Comments per author per minute. Generous for a person, useless for a script. */
const RATE_PER_MIN = 12;

export interface LiveCommentDTO {
  id: string;
  authorUserId: string | null;
  authorName: string;
  authorAvatar: string | null;
  body: string;
  createdAt: string;
  /** True when the viewer wrote it, so the client can offer Delete. */
  isMine: boolean;
  /** True when the viewer may remove it — author, broadcaster or admin. */
  canRemove: boolean;
}

interface Row {
  id: string;
  authorUserId: string | null;
  authorNameSnapshot: string;
  authorAvatarSnapshot: string | null;
  body: string;
  createdAt: Date;
}

function toDto(
  r: Row,
  viewerId: string | null,
  isOwner: boolean,
  mask: (t: string) => string,
): LiveCommentDTO {
  const isMine = !!viewerId && r.authorUserId === viewerId;
  return {
    id: r.id,
    authorUserId: r.authorUserId,
    authorName: r.authorNameSnapshot,
    authorAvatar: r.authorAvatarSnapshot,
    body: mask(r.body),
    createdAt: r.createdAt.toISOString(),
    isMine,
    canRemove: isMine || isOwner,
  };
}

const SELECT = {
  id: true,
  authorUserId: true,
  authorNameSnapshot: true,
  authorAvatarSnapshot: true,
  body: true,
  createdAt: true,
} as const;

/* ── reading ─────────────────────────────────────────────────── */

export async function listComments(opts: {
  streamId: string;
  viewerId: string | null;
  isOwner: boolean;
  /** Tail mode: everything newer than this, oldest first. For SSE. */
  after?: string | null;
  /** Page mode: the newest N, oldest first for rendering. */
  limit?: number;
}): Promise<LiveCommentDTO[]> {
  const mask = await getMasker();
  const blocked = opts.viewerId ? await getBlockedIds(opts.viewerId) : [];

  const base = {
    streamId: opts.streamId,
    removedAt: null,
    ...(blocked.length ? { authorUserId: { notIn: blocked } } : {}),
  };

  if (opts.after) {
    // (createdAt, id), not createdAt alone: two comments in the same
    // millisecond and the strict `gt` used to drop one of them for
    // good. See @/lib/cursor.
    const cursor = parseCursor(opts.after);
    const rows = await prisma.liveComment.findMany({
      where: cursor ? { AND: [base, newerThan(cursor)] } : base,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      // A hard ceiling: if a tab was backgrounded through a busy
      // stream, catching up must not mean loading the whole hour.
      take: 200,
      select: SELECT,
    });
    return rows.map((r) => toDto(r, opts.viewerId, opts.isOwner, mask));
  }

  const limit = Math.min(100, Math.max(10, opts.limit ?? 50));
  const rows = await prisma.liveComment.findMany({
    where: base,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: SELECT,
  });
  // Queried newest-first so the limit takes the RECENT ones, then
  // reversed — chat reads downwards.
  return rows.reverse().map((r) => toDto(r, opts.viewerId, opts.isOwner, mask));
}

/* ── writing ─────────────────────────────────────────────────── */

export type CreateResult =
  | { ok: true; comment: LiveCommentDTO }
  | { ok: false; error: "EMPTY" | "TOO_LONG" | "NOT_LIVE" | "RATE_LIMITED" };

export async function createComment(opts: {
  streamId: string;
  status: string;
  isOwner: boolean;
  user: { id: string; displayName: string; avatarUrl: string | null };
  body: string;
}): Promise<CreateResult> {
  const body = opts.body.trim();
  if (!body) return { ok: false, error: "EMPTY" };
  if (body.length > MAX_BODY) return { ok: false, error: "TOO_LONG" };
  if (opts.status !== "LIVE") return { ok: false, error: "NOT_LIVE" };

  const recent = await prisma.liveComment.count({
    where: {
      authorUserId: opts.user.id,
      createdAt: { gte: new Date(Date.now() - 60_000) },
    },
  });
  if (recent >= RATE_PER_MIN) return { ok: false, error: "RATE_LIMITED" };

  const row = await prisma.liveComment.create({
    data: {
      streamId: opts.streamId,
      authorUserId: opts.user.id,
      // Snapshotted at write time — see the note at the top of the
      // model. The name shown against a comment is the name they had
      // when they said it.
      authorNameSnapshot: opts.user.displayName.slice(0, 120),
      authorAvatarSnapshot: opts.user.avatarUrl,
      body,
    },
    select: SELECT,
  });

  const mask = await getMasker();
  return { ok: true, comment: toDto(row, opts.user.id, opts.isOwner, mask) };
}

/* ── moderation ──────────────────────────────────────────────── */

export async function removeComment(opts: {
  id: string;
  streamId: string;
  viewerId: string;
  isOwner: boolean;
  isAdmin?: boolean;
}): Promise<boolean> {
  const row = await prisma.liveComment.findUnique({
    where: { id: opts.id },
    select: { id: true, streamId: true, authorUserId: true, removedAt: true },
  });
  // Scoped to the stream in the URL as well as the id: without it,
  // a broadcaster could remove comments from someone else's chat by
  // posting an id from it to their own stream's endpoint.
  if (!row || row.streamId !== opts.streamId || row.removedAt) return false;

  const isAuthor = row.authorUserId === opts.viewerId;
  if (!isAuthor && !opts.isOwner && !opts.isAdmin) return false;

  await prisma.liveComment.update({
    where: { id: opts.id },
    data: {
      removedAt: new Date(),
      removedBy: isAuthor ? "AUTHOR" : opts.isOwner ? "OWNER" : "ADMIN",
    },
  });
  return true;
}
