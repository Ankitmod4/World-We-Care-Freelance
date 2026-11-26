/**
 * GET  /api/user/live/[slug]/comments — the recent chat.
 * POST /api/user/live/[slug]/comments — say something.
 *
 * GET IS DELIBERATELY UNAUTHENTICATED. A public broadcast is watchable
 * with no account, so its chat has to be readable on the same terms —
 * otherwise a signed-out viewer gets a locked panel next to a stream
 * they are welcome to watch. Visibility is enforced by `getBySlug`,
 * which is the same gate the player itself goes through.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";
import { getBySlug } from "@/lib/live-streams";
import { createComment, listComments, MAX_BODY } from "@/lib/live-comments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  // The chat belongs to the broadcast, and the broadcast needs an
  // account now. Leaving this open would hand a signed-out visitor
  // the conversation without the video.
  if (!viewer) return NextResponse.json({ error: "Sign in to watch." }, { status: 401 });
  const stream = await getBySlug(slug, viewer.id);
  if (!stream) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sp = new URL(request.url).searchParams;
  const comments = await listComments({
    streamId: stream.id,
    viewerId: viewer.id,
    isOwner: stream.isMine,
    after: sp.get("after"),
    limit: Number(sp.get("limit")) || undefined,
  });

  return NextResponse.json(
    { comments, canPost: stream.status === "LIVE" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stream = await getBySlug(slug, viewer.id);
  if (!stream) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { body?: unknown } | null;
  const text = typeof body?.body === "string" ? body.body : "";

  const result = await createComment({
    streamId: stream.id,
    status: stream.status,
    isOwner: stream.isMine,
    user: { id: viewer.id, displayName: viewer.displayName, avatarUrl: viewer.avatarUrl },
    body: text,
  });

  if (!result.ok) {
    const messages: Record<string, string> = {
      EMPTY: "Say something first.",
      TOO_LONG: `Keep it under ${MAX_BODY} characters.`,
      NOT_LIVE: "This broadcast has ended.",
      RATE_LIMITED: "You're sending messages very quickly. Wait a moment.",
    };
    const status = result.error === "RATE_LIMITED" ? 429 : 400;
    return NextResponse.json({ error: messages[result.error] }, { status });
  }

  return NextResponse.json({ comment: result.comment }, { status: 201 });
}
