/**
 * User-facing feed reads. Separate from posts-admin because the
 * viewer surface never touches removed/pending rows and joins the
 * viewer's own like/save state into every row so the client doesn't
 * need a second round-trip.
 *
 * Cursor pagination on (createdAt, id) — cheaper than offset and
 * stable under concurrent inserts. `cursor` is the last row's
 * createdAt-ISO + id; `nextCursor` on the response tells the
 * client what to send next (null when the feed is exhausted).
 */

import { type ReactionType } from "./reactions";
import { REACTION_VERB, reactionOutcome } from "./reaction-toggle";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getMasker } from "./banned-words";
import { createUserNotification } from "./notifications";

export interface FeedPost {
  id: string;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  body: string;
  images: Array<{ url: string; alt?: string | null }>;
  video: PostVideo | null;
  isAnonymous: boolean;
  isFeatured: boolean;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  liked: boolean;
  /** Which one the viewer left, or null. `liked` is `myReaction !== null`. */
  myReaction: ReactionType | null;
  saved: boolean;
  isOwn: boolean;
  countryName: string | null;
  /**
   * ISO 3166-1 alpha-2, so the card can print the name in the
   * reader's language. `countryName` stays as the fallback for a row
   * whose country predates the code column.
   */
  countryCode: string | null;
  createdAt: string;
}

export interface FeedPage {
  items: FeedPost[];
  nextCursor: string | null;
}

export interface FeedOptions {
  viewerId: string | null;
  cursor?: string | null;
  limit?: number;
  countryId?: string;
  /** Restrict to a single author — powers the profile "my posts" tab. */
  authorId?: string;
  /** Hide these authors (viewer's block list). */
  blockedIds?: string[];
  /** Exclude anonymous posts (public profile view). */
  excludeAnonymous?: boolean;
}

function parseImages(raw: unknown): Array<{ url: string; alt?: string | null }> {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (
      item && typeof item === "object" &&
      "url" in item && typeof (item as { url: unknown }).url === "string"
    ) {
      const cast = item as { url: string; alt?: unknown };
      return [{ url: cast.url, alt: typeof cast.alt === "string" ? cast.alt : null }];
    }
    return [];
  });
}

export interface PostVideo {
  assetId: string;
  url: string;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
}

/**
 * The stored video blob, defensively. It was written by the server
 * from a VideoAsset row, but a JSON column has no schema — a row
 * written by an older build, or edited by hand, must not crash the
 * whole feed.
 *
 * Exported so the admin projection uses the same parser rather than a
 * near-copy that drifts.
 */
export function parseVideo(raw: unknown): PostVideo | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.url !== "string" || !v.url) return null;
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
  return {
    assetId: typeof v.assetId === "string" ? v.assetId : "",
    url: v.url,
    posterUrl: typeof v.posterUrl === "string" ? v.posterUrl : null,
    width: num(v.width),
    height: num(v.height),
    durationSec: num(v.durationSec),
  };
}

function encodeCursor(row: { createdAt: Date; id: string }): string {
  return `${row.createdAt.toISOString()}_${row.id}`;
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  const idx = cursor.lastIndexOf("_");
  if (idx <= 0) return null;
  const iso = cursor.slice(0, idx);
  const id = cursor.slice(idx + 1);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || !id) return null;
  return { createdAt: d, id };
}

/** Shared row → FeedPost projection so the feed, saved, and profile
 *  surfaces all render identical cards. */
function toFeedPost(
  p: {
    id: string;
    authorId: string | null;
    authorNameSnapshot: string;
    authorAvatarSnapshot: string | null;
    body: string;
    images: unknown;
    video?: unknown;
    isAnonymous: boolean;
    isFeatured: boolean;
    likeCount: number;
    commentCount: number;
    saveCount: number;
    createdAt: Date;
    country?: { name: string; code: string } | null;
  },
  viewerId: string | null,
  liked: boolean,
  saved: boolean,
  myReaction: ReactionType | null = null,
): FeedPost {
  return {
    id: p.id,
    authorId: p.authorId,
    authorName: p.authorNameSnapshot,
    authorAvatar: p.authorAvatarSnapshot,
    body: p.body,
    images: parseImages(p.images),
    video: parseVideo(p.video),
    isAnonymous: p.isAnonymous,
    isFeatured: p.isFeatured,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    saveCount: p.saveCount,
    liked,
    myReaction,
    saved,
    isOwn: viewerId !== null && p.authorId === viewerId,
    countryName: p.country?.name ?? null,
    countryCode: p.country?.code ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

/**
 * Snapshots capture the author's name/avatar at post time, but members
 * expect their *current* picture and name on their non-anonymous posts.
 * Overlay the live User values (batched); anonymous posts keep the
 * snapshot ("Anonymous") and deleted authors fall back to it too.
 */
async function hydrateLiveAuthors(items: FeedPost[]): Promise<void> {
  const ids = Array.from(
    new Set(items.filter((p) => !p.isAnonymous && p.authorId).map((p) => p.authorId as string)),
  );
  if (!ids.length) return;
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, displayName: true, avatarUrl: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  for (const p of items) {
    if (p.isAnonymous || !p.authorId) continue;
    const u = byId.get(p.authorId);
    if (u) {
      p.authorName = u.displayName;
      p.authorAvatar = u.avatarUrl;
    }
  }
}

/**
 * The viewer's own like/save state for a whole page of posts.
 *
 * `liked` carries WHICH reaction, not just that there was one, so the
 * card can show the right emoji without a second round trip.
 *
 * There is deliberately no per-post breakdown here. The card shows the
 * viewer's own reaction and `Post.likeCount`; nothing renders "3 🤗,
 * 1 💪", so a groupBy on every feed page would be an aggregate query
 * with no reader. If that row ever comes back, it comes back as one
 * groupBy over all the ids — never one query per post.
 */
async function viewerState(
  viewerId: string | null,
  ids: string[],
): Promise<{ liked: Map<string, ReactionType>; saved: Set<string> }> {
  if (ids.length === 0 || !viewerId) {
    return { liked: new Map(), saved: new Set() };
  }

  const [likes, saves] = await Promise.all([
    prisma.postLike.findMany({
      where: { userId: viewerId, postId: { in: ids } },
      select: { postId: true, type: true },
    }),
    prisma.postSave.findMany({
      where: { userId: viewerId, postId: { in: ids } },
      select: { postId: true },
    }),
  ]);

  return {
    liked: new Map(likes.map((l) => [l.postId, l.type as ReactionType])),
    saved: new Set(saves.map((s) => s.postId)),
  };
}

export async function listFeed(opts: FeedOptions): Promise<FeedPage> {
  const limit = Math.min(50, Math.max(5, opts.limit ?? 20));

  const where: Prisma.PostWhereInput = { status: "PUBLISHED" };

  /*
   * Banning did not hide anything the person had written.
   *
   * `banUserAdmin` sets User.bannedAt / isActive and stops there, and
   * the profile page and follow lists both check those columns — but
   * the feed only ever filtered on the POST's own status, so a banned
   * account's posts stayed in everyone's feed indefinitely. Banning
   * removed the person and left the content.
   *
   * `authorId` is nullable on purpose (hard-deleting a member leaves
   * their posts standing behind a name snapshot), so a null author has
   * to pass — otherwise this fix would silently delete history from
   * the feed. `is: null` is how Prisma matches an absent relation.
   */
  where.AND = [
    {
      OR: [
        { author: { is: null } },
        { author: { is: { isActive: true, bannedAt: null } } },
      ],
    },
  ];

  if (opts.countryId) where.countryId = opts.countryId;
  if (opts.authorId) where.authorId = opts.authorId;
  else if (opts.blockedIds && opts.blockedIds.length) where.authorId = { notIn: opts.blockedIds };
  if (opts.excludeAnonymous) where.isAnonymous = false;

  // Cursor: rows strictly older than (createdAt, id).
  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
  if (cursor) {
    where.OR = [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ];
  }

  const rows = await prisma.post.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1, // fetch one extra so we know whether there's more
    include: {
      country: { select: { name: true, code: true } },
    },
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;

  const { liked, saved } = await viewerState(
    opts.viewerId,
    slice.map((r) => r.id),
  );

  const mask = await getMasker();
  const items = slice.map((p) => {
    const dto = toFeedPost(
      p,
      opts.viewerId,
      liked.has(p.id),
      saved.has(p.id),
      liked.get(p.id) ?? null,
    );
    dto.body = mask(dto.body);
    return dto;
  });
  await hydrateLiveAuthors(items);
  return {
    items,
    nextCursor: hasMore ? encodeCursor(slice[slice.length - 1]!) : null,
  };
}

/**
 * Single post for the permalink / detail page. Returns null for a
 * missing or non-published post so the route can 404.
 */
export async function getPost(
  viewerId: string | null,
  postId: string,
): Promise<FeedPost | null> {
  const p = await prisma.post.findUnique({
    where: { id: postId },
    include: { country: { select: { name: true, code: true } } },
  });
  if (!p || p.status !== "PUBLISHED") return null;

  let liked = false;
  let saved = false;
  let myReaction: ReactionType | null = null;
  if (viewerId) {
    const [l, s] = await Promise.all([
      prisma.postLike.findUnique({
        where: { postId_userId: { postId, userId: viewerId } },
        select: { postId: true, type: true },
      }),
      prisma.postSave.findUnique({
        where: { postId_userId: { postId, userId: viewerId } },
        select: { postId: true },
      }),
    ]);
    liked = !!l;
    saved = !!s;
    myReaction = (l?.type as ReactionType | undefined) ?? null;
  }
  const mask = await getMasker();
  const dto = toFeedPost(p, viewerId, liked, saved, myReaction);
  dto.body = mask(dto.body);
  await hydrateLiveAuthors([dto]);
  return dto;
}

/**
 * The viewer's bookmarked posts, newest-save first. Cursor is over
 * the PostSave.createdAt (when they saved it), not the post's own
 * timestamp — so re-saving an old post surfaces it at the top.
 */
export async function listSaved(opts: {
  viewerId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<FeedPage> {
  const limit = Math.min(50, Math.max(5, opts.limit ?? 20));

  const where: Prisma.PostSaveWhereInput = {
    userId: opts.viewerId,
    post: { status: "PUBLISHED" },
  };

  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
  if (cursor) {
    where.OR = [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, postId: { lt: cursor.id } },
    ];
  }

  const rows = await prisma.postSave.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { postId: "desc" }],
    take: limit + 1,
    include: { post: { include: { country: { select: { name: true, code: true } } } } },
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;

  // Everything here is saved by definition; only like-state needs a join.
  const { liked } = await viewerState(
    opts.viewerId,
    slice.map((r) => r.postId),
  );

  const mask = await getMasker();
  const items = slice.map((row) => {
    const dto = toFeedPost(
      row.post,
      opts.viewerId,
      liked.has(row.postId),
      true,
      liked.get(row.postId) ?? null,
    );
    dto.body = mask(dto.body);
    return dto;
  });
  await hydrateLiveAuthors(items);
  return {
    items,
    nextCursor: hasMore
      ? encodeCursor({ createdAt: slice[slice.length - 1]!.createdAt, id: slice[slice.length - 1]!.postId })
      : null,
  };
}

/* ── Toggles: like / save ────────────────────────────────────── */

/**
 * Toggle like. Returns the new state + fresh count. Uses a
 * transaction so counter never drifts from the join table.
 */
/**
 * Leave, change, or take back a reaction.
 *
 * THREE OUTCOMES, AND THE MIDDLE ONE IS THE POINT:
 *   • none → some      a row appears, `likeCount` goes up
 *   • some → different the row's `type` changes, count UNCHANGED
 *   • same → same      the row goes, `likeCount` goes down
 *
 * Changing your mind from 👍 to 🤗 must not read as two people
 * responding, and must not notify the author twice. That is the whole
 * reason the reaction lives on the like row rather than in a table of
 * its own.
 *
 * `type` omitted means LIKE, so an old client that posts an empty body
 * still works exactly as it did.
 */
export async function toggleLike(
  userId: string,
  postId: string,
  likerName?: string,
  rawType?: unknown,
): Promise<{ liked: boolean; likeCount: number; myReaction: ReactionType | null }> {
  const existing = await prisma.postLike.findUnique({
    where: { postId_userId: { postId, userId } },
    select: { type: true },
  });
  const outcome = reactionOutcome((existing?.type as ReactionType) ?? null, rawType);
  const { type } = outcome;

  if (existing) {
    // Same one again — take it back.
    if (outcome.kind === "removed") {
      const [, updated] = await prisma.$transaction([
        prisma.postLike.delete({ where: { postId_userId: { postId, userId } } }),
        prisma.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        }),
      ]);
      return { liked: false, likeCount: Math.max(0, updated.likeCount), myReaction: null };
    }

    // Changed their mind. One row, one person, one notification —
    // which already happened the first time.
    const [, post] = await prisma.$transaction([
      prisma.postLike.update({
        where: { postId_userId: { postId, userId } },
        data: { type },
      }),
      prisma.post.findUniqueOrThrow({ where: { id: postId }, select: { likeCount: true } }),
    ]);
    return { liked: true, likeCount: Math.max(0, post.likeCount), myReaction: type };
  }

  // Verify the post exists + is published before inserting so we
  // don't create a like row against a removed post.
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { status: true, authorId: true, body: true },
  });
  if (!post) throw new Error("Post not found");
  if (post.status !== "PUBLISHED") throw new Error("Post not available");

  const [, updated] = await prisma.$transaction([
    prisma.postLike.create({ data: { postId, userId, type } }),
    prisma.post.update({
      where: { id: postId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    }),
  ]);
  if (post.authorId && post.authorId !== userId) {
    await createUserNotification({
      userId: post.authorId,
      type: "POST_LIKE",
      // Says WHICH one. "Someone reacted" is a worse notification than
      // "Marie said me too", and on this site the difference matters.
      title: `${likerName ?? "Someone"} ${REACTION_VERB[type]} your post`,
      body: post.body.slice(0, 120),
      actionUrl: `/post/${postId}`,
    });
  }
  return { liked: true, likeCount: updated.likeCount, myReaction: type };
}

export async function toggleSave(
  userId: string,
  postId: string,
): Promise<{ saved: boolean; saveCount: number }> {
  const existing = await prisma.postSave.findUnique({
    where: { postId_userId: { postId, userId } },
    select: { postId: true },
  });

  if (existing) {
    const [, updated] = await prisma.$transaction([
      prisma.postSave.delete({ where: { postId_userId: { postId, userId } } }),
      prisma.post.update({
        where: { id: postId },
        data: { saveCount: { decrement: 1 } },
        select: { saveCount: true },
      }),
    ]);
    return { saved: false, saveCount: Math.max(0, updated.saveCount) };
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { status: true },
  });
  if (!post) throw new Error("Post not found");
  if (post.status !== "PUBLISHED") throw new Error("Post not available");

  const [, updated] = await prisma.$transaction([
    prisma.postSave.create({ data: { postId, userId } }),
    prisma.post.update({
      where: { id: postId },
      data: { saveCount: { increment: 1 } },
      select: { saveCount: true },
    }),
  ]);
  return { saved: true, saveCount: updated.saveCount };
}
