/** GET the thread on a clip · POST a comment or a reply. */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/user-auth";
import { addClipComment, listClipComments } from "@/lib/clip-comments";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Signed-in readers get their own liked-state on each comment;
  // signed-out readers still see the thread. Same as articles.
  const viewer = await getCurrentUser();
  return NextResponse.json({ comments: await listClipComments(id, viewer?.id ?? null) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const b = (await request.json().catch(() => ({}))) as {
    body?: unknown;
    isAnonymous?: unknown;
    parentId?: unknown;
  };

  try {
    return NextResponse.json(
      await addClipComment({
        clipId: id,
        userId: auth.id,
        displayName: auth.displayName,
        avatarUrl: auth.avatarUrl,
        body: typeof b.body === "string" ? b.body : "",
        isAnonymous: b.isAnonymous === true,
        // Validated in the lib: it must exist, be on THIS clip, and a
        // reply to a reply is flattened to the top-level comment.
        parentId: typeof b.parentId === "string" ? b.parentId : null,
      }),
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't post that." },
      { status: 400 },
    );
  }
}
