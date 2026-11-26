/**
 * POST /api/user/posts/comments/[id]/report
 *
 * Body: { reason: ReportReason, notes?: string }
 *
 * Same contract as the post-report endpoint; different URL because
 * the {id} here is a comment id.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { prisma } from "@/lib/db";
import { isValidReason, reportPost } from "@/lib/posts-user";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id: commentId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    reason?: unknown;
    notes?: unknown;
  };
  if (!isValidReason(body.reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 2000) : undefined;

  const c = await prisma.postComment.findUnique({
    where: { id: commentId },
    select: { postId: true },
  });
  if (!c) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

  try {
    const outcome = await reportPost({
      postId: c.postId,
      commentId,
      reporterId: auth.id,
      reason: body.reason,
      notes,
    });
    return NextResponse.json({ ok: true, duplicate: outcome.duplicate });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Report failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
