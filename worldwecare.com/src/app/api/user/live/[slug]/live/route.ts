/**
 * POST — the publisher connected; confirm it and go live.
 *
 * Separate from /start on purpose. /start hands out a ticket, which is
 * an intention; this says the media server has actually seen a
 * publisher, which is a fact — and it checks with MediaMTX rather
 * than taking the browser's word, because the browser is the one
 * component that cannot be trusted about whether its own upload
 * worked.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { confirmLive } from "@/lib/live-streams";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await params;
  try {
    // `problem` carries the reason a connected publisher still isn't
    // watchable — an unplayable codec, or no video at all. The
    // broadcaster sees it instead of a generic failure.
    return NextResponse.json(await confirmLive(slug, auth.id));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't confirm the broadcast." },
      { status: 400 },
    );
  }
}
