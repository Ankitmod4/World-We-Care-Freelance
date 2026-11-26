/** POST — leave, change or take back a reaction on a comment. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { toggleGratitudeCommentReaction } from "@/lib/gratitude-comments";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { commentId } = await params;
  // Omitted means LIKE, so a caller that has not been updated behaves
  // exactly like the plain like button it used to be.
  const body = (await request.json().catch(() => ({}))) as { type?: unknown };
  try {
    return NextResponse.json(await toggleGratitudeCommentReaction(commentId, auth.id, body.type));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Couldn't update that.";
    return NextResponse.json({ error: msg }, { status: msg === "Comment not found" ? 404 : 400 });
  }
}
