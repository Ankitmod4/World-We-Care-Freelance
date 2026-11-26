/**
 * User blocking (one-directional): if A blocks B, A stops seeing B's
 * messages, posts, and comments. B is unaffected. Author identity is
 * scalar across the app, so blocking is a simple id set we exclude
 * from the viewer's reads.
 */

import { prisma } from "./db";

export async function getBlockedIds(viewerId: string): Promise<string[]> {
  const rows = await prisma.userBlock.findMany({
    where: { blockerId: viewerId },
    select: { blockedId: true },
  });
  return rows.map((r) => r.blockedId);
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  if (!blockedId) throw new Error("No user given.");
  if (blockerId === blockedId) throw new Error("You can't block yourself.");
  await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    update: {},
    create: { blockerId, blockedId },
  });
  // Blocking severs any follow relationship in either direction. Each
  // severed edge is somebody's follower count going down: the
  // directory orders by that column, so dropping rows without
  // adjusting it would leave a blocked pair ranked on followers they
  // no longer have.
  const severed = await prisma.userFollow.findMany({
    where: {
      OR: [
        { followerId: blockerId, followingId: blockedId },
        { followerId: blockedId, followingId: blockerId },
      ],
    },
    select: { followerId: true, followingId: true },
  });
  if (!severed.length) return;

  await prisma.$transaction([
    prisma.userFollow.deleteMany({
      where: {
        OR: severed.map((e) => ({ followerId: e.followerId, followingId: e.followingId })),
      },
    }),
    ...severed.map((e) =>
      prisma.user.update({
        where: { id: e.followingId },
        data: { followerCount: { decrement: 1 } },
      }),
    ),
  ]);
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
}

export async function listBlocked(viewerId: string) {
  const rows = await prisma.userBlock.findMany({
    where: { blockerId: viewerId },
    orderBy: { createdAt: "desc" },
  });
  const ids = rows.map((r) => r.blockedId);
  const users = ids.length
    ? await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, displayName: true, avatarUrl: true },
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => ({
    userId: r.blockedId,
    displayName: byId.get(r.blockedId)?.displayName ?? "Unknown member",
    avatarUrl: byId.get(r.blockedId)?.avatarUrl ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}
