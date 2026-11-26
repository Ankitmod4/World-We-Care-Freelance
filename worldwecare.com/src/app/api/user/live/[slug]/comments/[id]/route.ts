/**
 * DELETE /api/user/live/[slug]/comments/[id] — remove one.
 *
 * The author, the broadcaster, or an admin. The broadcaster matters
 * most: they are the one person watching their own chat in real time
 * while abuse is happening in it, and telling them to file a report
 * and wait is not moderation.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";
import { getBySlug } from "@/lib/live-streams";
import { removeComment } from "@/lib/live-comments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stream = await getBySlug(slug, viewer.id);
  if (!stream) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const done = await removeComment({
    id,
    streamId: stream.id,
    viewerId: viewer.id,
    isOwner: stream.isMine,
  });
  // Not yours and not there give the same answer, so this cannot be
  // used to test whether a comment id exists.
  if (!done) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
