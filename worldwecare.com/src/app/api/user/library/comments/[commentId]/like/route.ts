/** POST — toggle a like on a comment. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { toggleClipCommentLike } from "@/lib/clip-comments";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { commentId } = await params;
  const body = (await request.json().catch(() => ({}))) as { type?: unknown };
  try {
    return NextResponse.json(await toggleClipCommentLike(commentId, auth.id, body.type));
  } catch {
    return NextResponse.json({ error: "Couldn't update that." }, { status: 400 });
  }
}
