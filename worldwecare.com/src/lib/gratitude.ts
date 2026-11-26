/**
 * Gratitude wall — a simple, uplifting feed. Text-only entries with a
 * one-tap "grateful too" heart. New entries are held for admin approval
 * (status PENDING) before appearing publicly; authors always see their
 * own entries with a status badge. Bodies are masked for banned words
 * at read time and blocked authors are filtered out.
 */

import { reactionOutcome } from "./reaction-toggle";
import type { ReactionType } from "./reactions";
import type { Prisma, GratitudeStatus } from "@prisma/client";
import { prisma } from "./db";
import { getMasker } from "./banned-words";
import { createUserNotification } from "./notifications";
import { hasCategories } from "./post-categories";
import {
  attachedAssetId,
  readVideo,
  resolveAttachedVideo,
  type AttachedVideo,
} from "./attached-media";
import { discardVideo } from "./video-status";

const BODY_MAX = 1000;

export interface GratitudeItem {
  id: string;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  body: string;
  isAnonymous: boolean;
  heartCount: number;
  commentCount: number;
  hearted: boolean;
  /** Which reaction the viewer left, or null. */
  myReaction: ReactionType | null;
  isOwn: boolean;
  imageUrl: string | null;
  /**
   * The attached video, or null. A PHOTO OR A VIDEO, NEVER BOTH —
   * `createGratitude` refuses the pair, so a card never has to decide
   * which of the two gets its one square.
   */
  video: AttachedVideo | null;
  status: GratitudeStatus;
  rejectionReason: string | null;
  /** Null when uncategorised, which is allowed and common. */
  category: { id: string; name: string; slug: string; emoji: string | null } | null;
  createdAt: string;
}

export interface GratitudePage {
  items: GratitudeItem[];
  nextCursor: string | null;
}

function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString("base64url");
}
function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    const d = new Date(iso);
    if (!id || Number.isNaN(d.getTime())) return null;
    return { createdAt: d, id };
  } catch {
    return null;
  }
}

/** Public wall: APPROVED entries for everyone, plus the viewer's own
 *  (any status) so they can see their submission + its review state. */
export async function listGratitude(opts: {
  viewerId: string;
  cursor?: string | null;
  limit?: number;
  blockedIds?: string[];
  /** Filter to one category. Null or absent means every category,
   *  including the uncategorised — "Everything" is not a category. */
  categoryId?: string | null;
  /** Narrow to a single entry. See getGratitudeEntry. */
  entryId?: string;
}): Promise<GratitudePage> {
  const limit = Math.min(50, Math.max(5, opts.limit ?? 20));

  const and: Prisma.GratitudeEntryWhereInput[] = [
    { OR: [{ status: "APPROVED" }, { authorId: opts.viewerId }] },
  ];
  if (opts.blockedIds && opts.blockedIds.length) {
    and.push({ authorId: { notIn: opts.blockedIds } });
  }
  if (opts.categoryId) and.push({ categoryId: opts.categoryId });
  // Used by getGratitudeEntry so one entry and a page of them come
  // back through the same shaping code.
  if (opts.entryId) and.push({ id: opts.entryId });
  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
  if (cursor) {
    and.push({
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ],
    });
  }

  const rows = await prisma.gratitudeEntry.findMany({
    where: { AND: and },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: {
      category: { select: { id: true, name: true, slug: true, emoji: true } },
    },
  });
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;

  const ids = slice.map((r) => r.id);
  const mine = ids.length
    ? await prisma.gratitudeHeart.findMany({
        where: { userId: opts.viewerId, entryId: { in: ids } },
        select: { entryId: true, type: true },
      })
    : [];
  const hearted = new Map(mine.map((x) => [x.entryId, x.type as ReactionType]));

  const authorIds = Array.from(new Set(slice.filter((r) => !r.isAnonymous).map((r) => r.authorId)));
  const users = authorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, displayName: true, avatarUrl: true },
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));

  const mask = await getMasker();

  const items: GratitudeItem[] = slice.map((r) => {
    const isOwn = r.authorId === opts.viewerId;
    const live = !r.isAnonymous ? byId.get(r.authorId) : undefined;
    return {
      id: r.id,
      authorId: r.isAnonymous ? null : r.authorId,
      authorName: r.isAnonymous ? "Anonymous" : live?.displayName ?? r.authorNameSnapshot,
      authorAvatar: r.isAnonymous ? null : live?.avatarUrl ?? r.authorAvatarSnapshot,
      body: mask(r.body),
      imageUrl: r.imageUrl,
      // A JSON column, so read defensively rather than cast — see
      // `readVideo`.
      video: readVideo(r.video),
      isAnonymous: r.isAnonymous,
      heartCount: r.heartCount,
      commentCount: r.commentCount,
      hearted: hearted.has(r.id),
      myReaction: hearted.get(r.id) ?? null,
      isOwn,
      status: r.status,
      rejectionReason: isOwn ? r.rejectionReason : null,
      category: r.category,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return { items, nextCursor: hasMore ? encodeCursor(slice[slice.length - 1]!) : null };
}

export async function createGratitude(
  userId: string,
  input: {
    body: string;
    imageUrl?: string | null;
    /**
     * A VideoAsset id, NEVER a URL. `resolveAttachedVideo` is what
     * turns it into something safe to persist: it checks the asset
     * exists, belongs to this member, and has finished converting.
     * Accepting a URL here would let anyone attach any file on the
     * server to their own entry.
     */
    videoAssetId?: string | null;
    isAnonymous?: boolean;
    authorName: string;
    authorAvatar: string | null;
    /**
     * Run through `validCategoryId` by the caller, so this is either a
     * real active category or null. Null is REJECTED below when the
     * community has categories — see the note on the check.
     */
    categoryId?: string | null;
  },
): Promise<GratitudeItem> {
  const body = (input.body ?? "").trim();
  if (!body) throw new Error("Write something you're grateful for.");
  if (body.length > BODY_MAX) throw new Error(`Keep it under ${BODY_MAX} characters.`);

  /*
   * A category is required.
   *
   * Enforced HERE, not only in the route, because this is the single
   * place a row is written — a future route, an import script or an
   * admin tool cannot get round it by forgetting.
   *
   * The column stays nullable in the schema and that is deliberate,
   * not an oversight. Posts made before this rule existed have no
   * category and must keep working, and the category relation is
   * `onDelete: SetNull` precisely so that retiring a category never
   * deletes the posts under it. A NOT NULL column would force one of
   * those two to give.
   *
   * `hasCategories` is the escape hatch: with none defined, there is
   * nothing to require and the composer stays usable.
   */
  if (!input.categoryId && (await hasCategories("gratitude"))) {
    throw new Error("Choose a category before sharing.");
  }

  const imageUrl = input.imageUrl?.trim() || null;

  /*
   * A PHOTO OR A VIDEO, NOT BOTH.
   *
   * The wall card has exactly one square slot (see EntryCardBody), so
   * an entry carrying both would leave the card silently choosing one
   * and dropping the other — the member would have attached something
   * that never appears anywhere. Refused here, where the row is
   * written, so a future route or import script cannot get round it.
   *
   * Checked BEFORE resolveAttachedVideo so the pair is rejected
   * without a database round trip.
   */
  if (imageUrl && input.videoAssetId?.trim()) {
    throw new Error("Attach a photo or a video, not both.");
  }

  /*
   * Resolved BEFORE the row is created, so a video that has not
   * finished converting — or one belonging to somebody else — throws
   * without leaving an entry behind it.
   */
  const video = await resolveAttachedVideo(input.videoAssetId, userId);

  const row = await prisma.gratitudeEntry.create({
    data: {
      authorId: userId,
      authorNameSnapshot: input.authorName,
      authorAvatarSnapshot: input.authorAvatar,
      body,
      imageUrl,
      video: video ? (video as unknown as Prisma.InputJsonObject) : undefined,
      isAnonymous: !!input.isAnonymous,
      categoryId: input.categoryId ?? null,
      // status defaults to PENDING
    },
    include: {
      category: { select: { id: true, name: true, slug: true, emoji: true } },
    },
  });

  const mask = await getMasker();
  return {
    id: row.id,
    authorId: row.isAnonymous ? null : row.authorId,
    authorName: row.isAnonymous ? "Anonymous" : input.authorName,
    authorAvatar: row.isAnonymous ? null : input.authorAvatar,
    body: mask(row.body),
    imageUrl: row.imageUrl,
    video,
    isAnonymous: row.isAnonymous,
    heartCount: 0,
    commentCount: 0,
    hearted: false,
    myReaction: null,
    isOwn: true,
    status: row.status,
    rejectionReason: null,
    category: row.category,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Leave, change or take back a reaction on a gratitude entry.
 *
 * `heartCount` counts people, not reactions — see reaction-toggle.ts
 * for why the middle case must not move it.
 */
export async function toggleHeart(
  userId: string,
  entryId: string,
  rawType?: unknown,
): Promise<{ hearted: boolean; heartCount: number; myReaction: ReactionType | null }> {
  // Can only react to an approved entry.
  const entry = await prisma.gratitudeEntry.findUnique({
    where: { id: entryId },
    select: { status: true },
  });
  if (!entry || entry.status !== "APPROVED") throw new Error("This entry isn't available.");

  const existing = await prisma.gratitudeHeart.findUnique({
    where: { entryId_userId: { entryId, userId } },
    select: { type: true },
  });
  const outcome = reactionOutcome((existing?.type as ReactionType) ?? null, rawType);

  if (outcome.kind === "removed") {
    const [, updated] = await prisma.$transaction([
      prisma.gratitudeHeart.delete({ where: { entryId_userId: { entryId, userId } } }),
      prisma.gratitudeEntry.update({
        where: { id: entryId },
        data: { heartCount: { decrement: 1 } },
        select: { heartCount: true },
      }),
    ]);
    return { hearted: false, heartCount: Math.max(0, updated.heartCount), myReaction: null };
  }

  if (outcome.kind === "changed") {
    const [, current] = await prisma.$transaction([
      prisma.gratitudeHeart.update({
        where: { entryId_userId: { entryId, userId } },
        data: { type: outcome.type },
      }),
      prisma.gratitudeEntry.findUniqueOrThrow({
        where: { id: entryId },
        select: { heartCount: true },
      }),
    ]);
    return { hearted: true, heartCount: Math.max(0, current.heartCount), myReaction: outcome.type };
  }

  const [, updated] = await prisma.$transaction([
    prisma.gratitudeHeart.create({ data: { entryId, userId, type: outcome.type } }),
    prisma.gratitudeEntry.update({
      where: { id: entryId },
      data: { heartCount: { increment: 1 } },
      select: { heartCount: true },
    }),
  ]);
  return { hearted: true, heartCount: updated.heartCount, myReaction: outcome.type };
}

export async function deleteGratitude(userId: string, entryId: string): Promise<void> {
  const row = await prisma.gratitudeEntry.findUnique({
    where: { id: entryId },
    select: { authorId: true, video: true },
  });
  if (!row) return;
  if (row.authorId !== userId) throw new Error("You can only delete your own entries.");
  await prisma.gratitudeEntry.delete({ where: { id: entryId } });

  /*
   * The row is gone; the converted MP4 and its poster are not, and
   * nothing else will ever free them — `deleteAccount` sweeps a
   * member's assets only when the whole account goes.
   *
   * AFTER the delete, and swallowed: the entry leaving is what the
   * member asked for, and a file that outlives it is a wasted
   * megabyte rather than a failed request. `discardVideo` re-checks
   * ownership itself, so a hand-edited `video` blob naming someone
   * else's asset deletes nothing.
   */
  const assetId = attachedAssetId(row.video);
  if (assetId) {
    await discardVideo(assetId, { id: userId, isAdmin: false }).catch(() => {});
  }
}

/* ── Admin moderation ─────────────────────────────────────────── */

export interface GratitudeAdminItem {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  isAnonymous: boolean;
  body: string;
  imageUrl: string | null;
  /**
   * SHOWN TO THE MODERATOR, and that is the point of it being here.
   * Approving an entry whose video nobody watched is the same hole as
   * approving one whose text nobody read.
   */
  video: AttachedVideo | null;
  status: GratitudeStatus;
  rejectionReason: string | null;
  heartCount: number;
  createdAt: string;
  reviewedAt: string | null;
}

export async function listGratitudeAdmin(opts: {
  status?: GratitudeStatus | "ALL";
  cursor?: string | null;
  limit?: number;
}): Promise<{ items: GratitudeAdminItem[]; nextCursor: string | null }> {
  const limit = Math.min(50, Math.max(5, opts.limit ?? 30));
  const and: Prisma.GratitudeEntryWhereInput[] = [];
  if (opts.status && opts.status !== "ALL") and.push({ status: opts.status });
  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
  if (cursor) {
    and.push({
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ],
    });
  }

  const rows = await prisma.gratitudeEntry.findMany({
    where: and.length ? { AND: and } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;

  // Admin sees the real author even for anonymous entries.
  const authorIds = Array.from(new Set(slice.map((r) => r.authorId)));
  const users = authorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, displayName: true, avatarUrl: true },
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));

  const items: GratitudeAdminItem[] = slice.map((r) => {
    const live = byId.get(r.authorId);
    return {
      id: r.id,
      authorId: r.authorId,
      authorName: live?.displayName ?? r.authorNameSnapshot,
      authorAvatar: live?.avatarUrl ?? r.authorAvatarSnapshot,
      isAnonymous: r.isAnonymous,
      body: r.body,
      imageUrl: r.imageUrl,
      video: readVideo(r.video),
      status: r.status,
      rejectionReason: r.rejectionReason,
      heartCount: r.heartCount,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
    };
  });

  return { items, nextCursor: hasMore ? encodeCursor(slice[slice.length - 1]!) : null };
}

export async function countPendingGratitude(): Promise<number> {
  return prisma.gratitudeEntry.count({ where: { status: "PENDING" } });
}

export async function moderateGratitude(
  adminId: string,
  entryId: string,
  action: "approve" | "reject",
  reason?: string,
): Promise<GratitudeAdminItem> {
  const entry = await prisma.gratitudeEntry.findUnique({
    where: { id: entryId },
    select: { id: true, authorId: true, isAnonymous: true, body: true, imageUrl: true, video: true, authorNameSnapshot: true, authorAvatarSnapshot: true, heartCount: true, createdAt: true },
  });
  if (!entry) throw new Error("Entry not found.");

  const status: GratitudeStatus = action === "approve" ? "APPROVED" : "REJECTED";
  const cleanReason = action === "reject" ? (reason?.trim() || null) : null;

  const updated = await prisma.gratitudeEntry.update({
    where: { id: entryId },
    data: { status, rejectionReason: cleanReason, reviewedAt: new Date(), reviewedBy: adminId },
    select: { status: true, rejectionReason: true, reviewedAt: true },
  });

  // Notify the author of the decision.
  await createUserNotification({
    userId: entry.authorId,
    type: "SYSTEM",
    title: action === "approve" ? "Your gratitude post was approved" : "Your gratitude post wasn't approved",
    body:
      action === "approve"
        ? "It's now live on the gratitude wall for everyone to see."
        : cleanReason
          ? `Reason: ${cleanReason}`
          : "It didn't meet our community guidelines.",
    actionUrl: "/gratitude",
  });

  const live = await prisma.user.findUnique({
    where: { id: entry.authorId },
    select: { displayName: true, avatarUrl: true },
  });

  return {
    id: entry.id,
    authorId: entry.authorId,
    authorName: live?.displayName ?? entry.authorNameSnapshot,
    authorAvatar: live?.avatarUrl ?? entry.authorAvatarSnapshot,
    isAnonymous: entry.isAnonymous,
    body: entry.body,
    imageUrl: entry.imageUrl,
    video: readVideo(entry.video),
    status: updated.status,
    rejectionReason: updated.rejectionReason,
    heartCount: entry.heartCount,
    createdAt: entry.createdAt.toISOString(),
    reviewedAt: updated.reviewedAt?.toISOString() ?? null,
  };
}

/**
 * One entry, for /gratitude/[id].
 *
 * Built on `listGratitude` rather than a second query, so the DTO,
 * the banned-word masking, the anonymity rules and the viewer's own
 * reaction all come from exactly one place. A parallel implementation
 * here is how the detail page ends up showing a name the wall hides.
 *
 * Returns null for anything the viewer is not allowed to see —
 * `listGratitude` already limits that to APPROVED entries plus the
 * viewer's own.
 */
export async function getGratitudeEntry(
  entryId: string,
  viewerId: string,
  blockedIds?: string[],
): Promise<GratitudeItem | null> {
  const row = await prisma.gratitudeEntry.findUnique({
    where: { id: entryId },
    select: { id: true, status: true, authorId: true },
  });
  if (!row) return null;
  if (row.status !== "APPROVED" && row.authorId !== viewerId) return null;
  if (blockedIds?.includes(row.authorId)) return null;

  const { items } = await listGratitude({ viewerId, limit: 5, entryId });
  return items.find((i) => i.id === entryId) ?? null;
}
