/**
 * DELETE /api/user/posts/comments/[id] — the author removes their
 * own comment. 403 if the caller isn't the author; 404 if gone.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { deleteComment } from "@/lib/comments";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await deleteComment(auth.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    const status = msg === "Comment not found" ? 404 : msg === "Not your comment" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
