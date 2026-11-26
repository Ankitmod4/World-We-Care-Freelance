/**
 * DELETE /api/user/posts/[id] — the author removes their own post.
 * 403 if the caller isn't the author; 404 if it's already gone.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { deletePost } from "@/lib/posts-write";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await deletePost(auth.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    const status = msg === "Post not found" ? 404 : msg === "Not your post" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
