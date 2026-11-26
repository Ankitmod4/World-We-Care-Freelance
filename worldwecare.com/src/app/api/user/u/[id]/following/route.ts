/** GET /api/user/u/[id]/following — list with per-row viewer follow state. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listFollowing } from "@/lib/follows";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const list = await listFollowing(id);
  const ids = list.map((u) => u.id);
  const mine = ids.length
    ? await prisma.userFollow.findMany({
        where: { followerId: auth.id, followingId: { in: ids } },
        select: { followingId: true },
      })
    : [];
  const set = new Set(mine.map((f) => f.followingId));

  return NextResponse.json({
    users: list.map((u) => ({
      ...u,
      isFollowing: set.has(u.id),
      isSelf: u.id === auth.id,
    })),
  });
}
