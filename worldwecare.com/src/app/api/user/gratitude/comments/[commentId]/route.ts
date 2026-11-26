/** DELETE your own comment. The cascade takes its replies with it. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { deleteOwnGratitudeComment } from "@/lib/gratitude-comments";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { commentId } = await params;
  try {
    return NextResponse.json(await deleteOwnGratitudeComment(commentId, auth.id));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't delete that." },
      { status: 400 },
    );
  }
}
