/** DELETE your own comment. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { deleteOwnClipComment } from "@/lib/clip-comments";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { commentId } = await params;
  try {
    // Ownership is checked in the lib, not here — the id comes from
    // the URL and proves nothing on its own.
    return NextResponse.json({ ok: true, ...(await deleteOwnClipComment(commentId, auth.id)) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't delete that." },
      { status: 400 },
    );
  }
}
