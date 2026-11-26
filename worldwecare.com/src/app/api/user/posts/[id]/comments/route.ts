/**
 * GET  /api/user/posts/[id]/comments — cursor-paginated thread.
 * POST /api/user/posts/[id]/comments — add a comment (auth required).
 *
 * GET is public (anonymous readers can see the thread); POST needs a
 * signed-in user. Response shapes mirror the feed: { items, nextCursor }
 * for GET, { ok, comment } for POST.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/user-auth";
import { createComment, listComments } from "@/lib/comments";
import { getBlockedIds } from "@/lib/blocks";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getCurrentUser();
  const { id } = await params;
  const sp = new URL(request.url).searchParams;
  const cursor = sp.get("cursor") ?? undefined;
  const limitRaw = sp.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

  const page = await listComments({
    postId: id,
    viewerId: viewer?.id ?? null,
    cursor: cursor || null,
    limit,
    blockedIds: viewer ? await getBlockedIds(viewer.id) : [],
  });
  return NextResponse.json(page);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as {
    body?: unknown;
    isAnonymous?: unknown;
  };
  if (typeof body.body !== "string") {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }

  try {
    const comment = await createComment({
      postId: id,
      authorId: auth.id,
      body: body.body,
      isAnonymous: body.isAnonymous === true,
    });
    return NextResponse.json({ ok: true, comment }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Comment failed";
    const status = msg === "Post not found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
