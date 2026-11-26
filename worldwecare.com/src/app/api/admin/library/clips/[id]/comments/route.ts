/**
 * GET every comment on a clip, for moderation.
 *
 * Deliberately NOT `listClipComments`: that one hides removed rows and
 * masks anonymous authors, which is right for readers and wrong here.
 * A moderator has to see what was removed to un-remove it, and has to
 * see who wrote an anonymous comment to act on a pattern of them.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const rows = await prisma.clipComment.findMany({
    where: { clipId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      parentId: true,
      authorId: true,
      authorNameSnapshot: true,
      body: true,
      isAnonymous: true,
      status: true,
      removedReason: true,
      likeCount: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    comments: rows.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      authorId: r.authorId,
      authorName: r.authorNameSnapshot,
      body: r.body,
      isAnonymous: r.isAnonymous,
      status: r.status,
      removedReason: r.removedReason,
      likeCount: r.likeCount,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
