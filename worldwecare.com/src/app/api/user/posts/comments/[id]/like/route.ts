/**
 * POST — leave, change or take back a reaction on a post comment.
 *
 * The param is `id`, not `commentId`, because the sibling DELETE route
 * at ../route.ts already claims `[id]` and Next.js refuses two
 * different slug names for the same path segment.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { togglePostCommentReaction } from "@/lib/comments";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  // Omitted means LIKE, so a caller that has not been updated behaves
  // exactly like the plain like button it used to be.
  const body = (await request.json().catch(() => ({}))) as { type?: unknown };
  try {
    return NextResponse.json(await togglePostCommentReaction(id, auth.id, body.type));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Couldn't update that.";
    return NextResponse.json({ error: msg }, { status: msg === "Comment not found" ? 404 : 400 });
  }
}
