/** GET list / POST add a comment on an article. */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/user-auth";
import { addArticleComment, listArticleComments } from "@/lib/articles";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Signed-in readers get their own liked-state on each comment;
  // signed-out readers still see the thread.
  const viewer = await getCurrentUser();
  return NextResponse.json({ comments: await listArticleComments(id, viewer?.id ?? null) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.body !== "string" || !body.body.trim()) {
    return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
  }
  try {
    const res = await addArticleComment({
      articleId: id,
      userId: auth.id,
      displayName: auth.displayName,
      avatarUrl: auth.avatarUrl,
      body: body.body,
      isAnonymous: body.isAnonymous === true,
      parentId: typeof body.parentId === "string" ? body.parentId : null,
    });
    return NextResponse.json({ ok: true, ...res }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Comment failed";
    return NextResponse.json({ error: msg }, { status: msg === "Article not found" ? 404 : 400 });
  }
}
