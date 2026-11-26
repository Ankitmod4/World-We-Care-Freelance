/**
 * GET    /api/admin/posts/[id] — single post + all comments.
 * DELETE /api/admin/posts/[id] — permanent delete, media included.
 *
 * The soft "remove" moderation action lives at [id]/action and is
 * reversible; this one is not, so it is owner-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getPost, listComments, purgePost } from "@/lib/posts-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const [post, comments] = await Promise.all([getPost(id), listComments(id)]);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: post, comments });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only an owner can permanently delete a post. Use Remove instead — it can be undone." },
      { status: 403 },
    );
  }
  const { id } = await params;
  try {
    const { bytesFreed } = await purgePost(auth.id, id);
    return NextResponse.json({ ok: true, bytesFreed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 400 },
    );
  }
}
