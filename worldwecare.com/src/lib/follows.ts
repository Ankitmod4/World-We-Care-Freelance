/**
 * Follows — a simple directional social graph (follower → following).
 * One row per edge. Following is idempotent; a genuinely-new follow
 * fires a notification to the followed user. Blocking a member drops
 * any follow edges between the two (handled in blocks.ts).
 */

import { prisma } from "./db";
import type { FollowReason } from "./follow-reason";
import { createUserNotification } from "./notifications";

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  if (!followerId || !followingId || followerId === followingId) return false;
  const row = await prisma.userFollow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
    select: { id: true },
  });
  return !!row;
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    prisma.userFollow.count({ where: { followingId: userId } }),
    prisma.userFollow.count({ where: { followerId: userId } }),
  ]);
  return { followers, following };
}

export async function followUser(followerId: string, followingId: string, followerName?: string): Promise<void> {
  if (!followingId) throw new Error("No user given.");
  if (followerId === followingId) throw new Error("You can't follow yourself.");

  // Can't follow someone you've blocked (or who you've been blocked by,
  // as far as the viewer is concerned — we only track the viewer's blocks).
  const blocked = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: followerId, blockedId: followingId },
        { blockerId: followingId, blockedId: followerId },
      ],
    },
    select: { id: true },
  });
  if (blocked) throw new Error("You can't follow a blocked member.");

  // Idempotent: only notify on a genuinely new edge.
  const existing = await prisma.userFollow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
    select: { id: true },
  });
  if (existing) return;

  // One transaction: a follow row without its counter increment is a
  // directory that ranks people wrongly and never self-corrects.
  await prisma.$transaction([
    prisma.userFollow.create({ data: { followerId, followingId } }),
    prisma.user.update({
      where: { id: followingId },
      data: { followerCount: { increment: 1 } },
    }),
  ]);
  await createUserNotification({
    userId: followingId,
    type: "FOLLOW",
    title: `${followerName?.trim() || "Someone"} started following you`,
    actionUrl: `/u/${followerId}`,
  });
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  // deleteMany reports how many rows went, so the counter only moves
  // when an edge actually existed — unfollowing twice must not drive
  // somebody's follower count negative.
  const { count } = await prisma.userFollow.deleteMany({ where: { followerId, followingId } });
  if (count > 0) {
    await prisma.user.update({
      where: { id: followingId },
      data: { followerCount: { decrement: count } },
    });
  }
}

/** Members who follow `userId`. */
export async function listFollowers(userId: string) {
  const rows = await prisma.userFollow.findMany({
    where: { followingId: userId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return hydrate(rows.map((r) => r.followerId));
}

/** Members `userId` follows. */
export async function listFollowing(userId: string) {
  const rows = await prisma.userFollow.findMany({
    where: { followerId: userId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return hydrate(rows.map((r) => r.followingId));
}

async function hydrate(ids: string[]) {
  if (!ids.length) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, isActive: true, bannedAt: null },
    select: { id: true, displayName: true, avatarUrl: true, bio: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return ids
    .map((id) => byId.get(id))
    .filter((u): u is NonNullable<typeof u> => !!u)
    .map((u) => ({ id: u.id, displayName: u.displayName, avatarUrl: u.avatarUrl, bio: u.bio }));
}

/* ── Who to follow ──────────────────────────────────────────── */

export interface FollowSuggestion {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /**
   * Why this person is on the list, in plain words.
   *
   * EVERY REASON MUST BE SOMETHING THE VIEWER COULD ALREADY SEE. "Also
   * in Sobriety" is safe because it is only ever shown to someone who
   * is in Sobriety themselves and can open its roster. A reason drawn
   * from anything private would turn this card into a leak, so the
   * signals below are chosen for what they reveal, not just for how
   * well they rank.
   *
   * A SHAPE, NOT A SENTENCE — see `follow-reason.ts`. The words are
   * put together in the browser so they can be in the reader's
   * language.
   */
  reason: FollowReason;
}

/**
 * Suggestions for the right rail.
 *
 * THREE SIGNALS, BEST FIRST, TOPPED UP FROM THE ONE BELOW:
 *
 *   1. Shared rooms — you are already in a room together, so you can
 *      already see each other in its "who's here" panel.
 *   2. Followed by people you follow — follower lists are already
 *      readable at /api/user/u/[id]/following.
 *   3. Posting lately — someone whose posts you would actually see if
 *      you followed them. Ranked over "newest sign-ups" on purpose:
 *      following an account that never posts does nothing for a feed.
 *
 * NOTHING IS RANKED BY FOLLOWER COUNT, and no count is returned. On a
 * recipe site "12k followers" is a credential. Here it would turn a
 * peer-support space into a leaderboard, and the people worth
 * following on the worst day of your life are not the popular ones.
 *
 * ANONYMOUS POSTS ARE NEVER A SIGNAL. Signal 3 counts published posts
 * with `isAnonymous: false` only; surfacing somebody because of a post
 * they chose to sign anonymously would undo the choice.
 *
 * THE ORDER IS STABLE, not shuffled. The card sits on every page of a
 * community people come to when they are struggling; three strangers
 * reshuffling on every navigation reads like a slot machine. It
 * changes when the viewer follows someone, which is the point.
 */
export async function suggestFollows(
  viewerId: string,
  limit = 3,
): Promise<FollowSuggestion[]> {
  if (!viewerId) return [];

  // Never suggest yourself, anyone already followed, or either side of
  // a block. followUser() throws on a blocked pair, so a suggestion we
  // cannot act on would render a Follow button that only ever errors.
  const [following, blockedByMe, blockedMe] = await Promise.all([
    prisma.userFollow.findMany({ where: { followerId: viewerId }, select: { followingId: true } }),
    prisma.userBlock.findMany({ where: { blockerId: viewerId }, select: { blockedId: true } }),
    prisma.userBlock.findMany({ where: { blockedId: viewerId }, select: { blockerId: true } }),
  ]);
  const followingIds = following.map((f) => f.followingId);
  const skip = new Set<string>([
    viewerId,
    ...followingIds,
    ...blockedByMe.map((b) => b.blockedId),
    ...blockedMe.map((b) => b.blockerId),
  ]);

  /** id → reason, insertion-ordered, best signal first. */
  const picked = new Map<string, FollowReason>();

  // ── 1. shared rooms ──────────────────────────────────────────
  const mine = await prisma.chatMembership.findMany({
    where: { userId: viewerId, status: "ACTIVE" },
    select: { roomId: true },
  });
  if (mine.length) {
    const roomIds = mine.map((m) => m.roomId);
    const [others, rooms] = await Promise.all([
      prisma.chatMembership.findMany({
        where: {
          roomId: { in: roomIds },
          status: "ACTIVE",
          userId: { notIn: [...skip] },
        },
        select: { userId: true, roomId: true },
        take: 500,
      }),
      prisma.chatRoom.findMany({
        where: { id: { in: roomIds } },
        select: { id: true, name: true },
      }),
    ]);
    const roomName = new Map(rooms.map((r) => [r.id, r.name]));
    const shared = new Map<string, string[]>();
    for (const m of others) {
      const list = shared.get(m.userId) ?? [];
      list.push(m.roomId);
      shared.set(m.userId, list);
    }
    const ranked = [...shared.entries()].sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
    );
    for (const [userId, roomsShared] of ranked) {
      if (picked.size >= limit) break;
      const only = roomName.get(roomsShared[0]!);
      picked.set(
        userId,
        roomsShared.length > 1
          ? { kind: "sharedRooms", n: roomsShared.length }
          : only
            ? { kind: "sharedRoom", room: only, roomId: roomsShared[0]! }
            : { kind: "sharedRooms", n: 1 },
      );
    }
  }

  // ── 2. followed by people you follow ─────────────────────────
  if (picked.size < limit && followingIds.length) {
    const rows = await prisma.userFollow.findMany({
      where: {
        followerId: { in: followingIds },
        followingId: { notIn: [...skip, ...picked.keys()] },
      },
      select: { followingId: true },
      take: 500,
    });
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.followingId, (counts.get(r.followingId) ?? 0) + 1);
    const ranked = [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
    for (const [userId, n] of ranked) {
      if (picked.size >= limit) break;
      picked.set(
        userId,
        n === 1 ? { kind: "followedByOne" } : { kind: "followedByMany", n },
      );
    }
  }

  // ── 3. posting lately ────────────────────────────────────────
  if (picked.size < limit) {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const rows = await prisma.post.groupBy({
      by: ["authorId"],
      where: {
        status: "PUBLISHED",
        // See the docblock: a post somebody chose to sign anonymously
        // must never put their name on a list.
        isAnonymous: false,
        createdAt: { gte: since },
        authorId: { notIn: [...skip, ...picked.keys()] },
      },
      _count: { _all: true },
      // Prisma requires an orderBy alongside `take` on a groupBy; the
      // local sort below then only settles ties, deterministically.
      orderBy: { _count: { authorId: "desc" } },
      take: 100,
    });
    const ranked = rows
      .filter((r): r is typeof r & { authorId: string } => !!r.authorId)
      .sort((a, b) => b._count._all - a._count._all || a.authorId.localeCompare(b.authorId));
    for (const r of ranked) {
      if (picked.size >= limit) break;
      picked.set(r.authorId, { kind: "postingThisWeek" });
    }
  }

  // ── 4. last resort: the newest members ───────────────────────
  // A brand-new member is in no rooms, follows nobody and has read no
  // posts, so signals 1–3 give them an empty card on the one day the
  // card would help most.
  if (picked.size < limit) {
    const fresh = await prisma.user.findMany({
      where: {
        isActive: true,
        bannedAt: null,
        id: { notIn: [...skip, ...picked.keys()] },
      },
      orderBy: { createdAt: "desc" },
      take: limit - picked.size,
      select: { id: true },
    });
    for (const u of fresh) picked.set(u.id, { kind: "newHere" });
  }

  if (!picked.size) return [];

  // A membership row can outlive the account it points at, so the
  // active/banned gate goes here rather than being assumed above.
  const users = await prisma.user.findMany({
    where: { id: { in: [...picked.keys()] }, isActive: true, bannedAt: null },
    select: { id: true, displayName: true, avatarUrl: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return [...picked.keys()]
    .map((id) => {
      const u = byId.get(id);
      return u
        ? { id: u.id, displayName: u.displayName, avatarUrl: u.avatarUrl, reason: picked.get(id)! }
        : null;
    })
    .filter((s): s is FollowSuggestion => !!s)
    .slice(0, limit);
}

/* ── The members directory ──────────────────────────────────── */

export interface MemberRow {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  followerCount: number;
  isFollowing: boolean;
}

/** `${followerCount}:${id}` — the keyset the page orders on. */
function encodeMemberCursor(row: { followerCount: number; id: string }): string {
  return `${row.followerCount}:${row.id}`;
}

function decodeMemberCursor(raw: string | null | undefined): { count: number; id: string } | null {
  if (!raw) return null;
  const at = raw.indexOf(":");
  if (at < 1) return null;
  const count = Number(raw.slice(0, at));
  const id = raw.slice(at + 1);
  return Number.isFinite(count) && id ? { count, id } : null;
}

/**
 * The /members directory: everyone, most-followed first.
 *
 * ORDERED BY A DENORMALISED COLUMN, not by a COUNT() over the follow
 * table. Keyset pagination needs the sort key to live on the row being
 * paged, or every page re-aggregates every follow in the database.
 * `User.followerCount` is maintained by follow/unfollow and by
 * blockUser; `npm run follows:recount` rebuilds it if they drift.
 *
 * The tie-break is `id` ascending, which matters more than it looks:
 * most members have the same follower count (zero), so without a
 * second, unique sort key the cursor would skip and repeat people
 * across pages.
 *
 * EXCLUSIONS match the rest of the app — yourself, and both sides of a
 * block. Search does the same thing, for the same reason: a block is
 * meant to make somebody go away, and a directory that still lists
 * them is a hole in it.
 */
export async function listMembers(opts: {
  viewerId: string;
  q?: string | null;
  countryId?: string | null;
  cursor?: string | null;
  limit?: number;
}): Promise<{ items: MemberRow[]; nextCursor: string | null }> {
  // `|| 24`, not `?? 24`: the route passes Number(searchParam), so a
  // missing or unparseable ?limit= arrives as 0. Treating that as
  // "one member" rather than "the default" would be a surprising API,
  // and it is the route's own fallback, so the two agree.
  const limit = Math.min(Math.max(opts.limit || 24, 1), 60);
  const q = (opts.q ?? "").trim();

  const [blockedByMe, blockedMe] = await Promise.all([
    prisma.userBlock.findMany({ where: { blockerId: opts.viewerId }, select: { blockedId: true } }),
    prisma.userBlock.findMany({ where: { blockedId: opts.viewerId }, select: { blockerId: true } }),
  ]);
  const hidden = [
    opts.viewerId,
    ...blockedByMe.map((b) => b.blockedId),
    ...blockedMe.map((b) => b.blockerId),
  ].filter(Boolean);

  const after = decodeMemberCursor(opts.cursor);

  const rows = await prisma.user.findMany({
    where: {
      isActive: true,
      bannedAt: null,
      ...(hidden.length ? { id: { notIn: hidden } } : {}),
      ...(q ? { displayName: { contains: q } } : {}),
      ...(opts.countryId ? { countryId: opts.countryId } : {}),
      ...(after
        ? {
            OR: [
              { followerCount: { lt: after.count } },
              { followerCount: after.count, id: { gt: after.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ followerCount: "desc" }, { id: "asc" }],
    take: limit + 1,
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      location: true,
      followerCount: true,
    },
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;

  // One query for the whole page's follow state rather than one per
  // row, so the buttons render right on first paint.
  const mine = slice.length
    ? await prisma.userFollow.findMany({
        where: { followerId: opts.viewerId, followingId: { in: slice.map((u) => u.id) } },
        select: { followingId: true },
      })
    : [];
  const following = new Set(mine.map((f) => f.followingId));

  return {
    items: slice.map((u) => ({ ...u, isFollowing: following.has(u.id) })),
    nextCursor: hasMore ? encodeMemberCursor(slice[slice.length - 1]!) : null,
  };
}
