/** DELETE — a commenter removes their own article comment. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { deleteOwnArticleComment } from "@/lib/articles";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { commentId } = await params;
  try {
    return NextResponse.json({ ok: true, ...(await deleteOwnArticleComment(commentId, auth.id)) });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
