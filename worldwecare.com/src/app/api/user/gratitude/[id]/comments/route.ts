/** GET the thread on a gratitude entry · POST a comment or a reply. */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/user-auth";
import { addGratitudeComment, listGratitudeComments } from "@/lib/gratitude-comments";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Signed-out readers still see the thread — a comment nobody outside
  // the login wall can read is a comment written into a drawer. Same
  // as clips and articles.
  const viewer = await getCurrentUser();
  return NextResponse.json({ comments: await listGratitudeComments(id, viewer?.id ?? null) });
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
      await addGratitudeComment({
        entryId: id,
        userId: auth.id,
        displayName: auth.displayName,
        avatarUrl: auth.avatarUrl,
        body: typeof b.body === "string" ? b.body : "",
        isAnonymous: b.isAnonymous === true,
        // Validated in the lib: it must exist, be on THIS entry, and a
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
