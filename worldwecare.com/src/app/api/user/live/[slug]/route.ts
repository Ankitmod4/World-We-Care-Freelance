/**
 * GET — one stream, for the watch page.
 *
 * WATCHING REQUIRES AN ACCOUNT. Most of this site is readable signed
 * out on purpose, and broadcasts are the exception: a link was enough
 * to watch anybody's stream, including an unlisted one, and a link
 * travels further than the person who shared it meant it to.
 *
 * The gate is here and not only on the page because this route is
 * what hands out the manifest URL. A page that refuses to render
 * while its API still returns the address of the video is not a gate.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";
import { getBySlug } from "@/lib/live-streams";
import { getMediamtxConfig, hlsUrl, isConfigured } from "@/lib/mediamtx";
import { pathForStream } from "@/lib/live-streams";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) {
    return NextResponse.json({ error: "Sign in to watch." }, { status: 401 });
  }
  const stream = await getBySlug(slug, viewer.id);
  if (!stream) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const c = await getMediamtxConfig();
  return NextResponse.json({
    stream,
    // Only handed out while the stream is actually live — a manifest
    // URL for an ended stream is a 404 that looks like a bug.
    watchUrl:
      isConfigured(c) && stream.status === "LIVE"
        ? hlsUrl(c, pathForStream(c, stream.slug))
        : null,
  });
}
