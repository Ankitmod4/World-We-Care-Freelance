/** POST — toggle a like on an article comment. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { toggleArticleCommentLike } from "@/lib/articles";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { commentId } = await params;
  const body = (await request.json().catch(() => ({}))) as { type?: unknown };
  try {
    return NextResponse.json({ ok: true, ...(await toggleArticleCommentLike(commentId, auth.id, body.type)) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Like failed";
    return NextResponse.json({ error: msg }, { status: msg === "Comment not found" ? 404 : 400 });
  }
}
