/**
 * GET — how many people are watching, counted by the media server.
 *
 * Members only, like the broadcast itself. This used to be public on
 * the reasoning that "the number is already on the watch page for
 * everyone" — which stopped being true when watching started needing
 * an account, and a justification that has quietly expired is worse
 * than none.
 *
 * Cheap enough to poll, and it leaves the stored count alone when
 * MediaMTX can't be reached rather than dropping the display to zero
 * mid-broadcast.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";
import { getBySlug, refreshViewerCount } from "@/lib/live-streams";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ error: "Sign in to watch." }, { status: 401 });

  const fresh = await refreshViewerCount(slug);
  if (fresh !== null) return NextResponse.json({ viewers: fresh, live: true });

  const stream = await getBySlug(slug);
  if (!stream) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ viewers: stream.viewerCount, live: stream.status === "LIVE" });
}
