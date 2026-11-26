/**
 * GET /api/user/live/[slug]/comments/stream — Server-Sent Events.
 *
 * Same shape as the chatroom stream: one long-lived connection, a
 * poll on a short interval, a heartbeat on quiet cycles. Not a
 * pub/sub bus, and does not need to be — a broadcast has one writer
 * for the video and a handful for the chat.
 *
 * OPEN TO SIGNED-OUT VIEWERS, unlike the chatroom one, for the reason
 * in the comments route: they are allowed to watch, so they are
 * allowed to read along.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";
import { getBySlug } from "@/lib/live-streams";
import { listComments } from "@/lib/live-comments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Faster than the chatroom's 2.5s — chat under a live video is the
 *  one place a two-second lag is felt as lag. */
const POLL_MS = 1500;
const HEARTBEAT_MS = 20_000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  // Same rule as the chat's GET — and it matters more here, because a
  // stream left open feeds every new comment to whoever holds it.
  if (!viewer) return NextResponse.json({ error: "Sign in to watch." }, { status: 401 });
  const stream = await getBySlug(slug, viewer.id);
  if (!stream) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sp = new URL(request.url).searchParams;
  // A "<iso>|<id>" cursor string, not a Date — resuming from a bare
  // timestamp drops a comment that shares the boundary millisecond.
  let cursor = sp.get("after") ?? new Date().toISOString();
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let cancelled = false;
      let lastBeat = Date.now();

      const tick = async () => {
        if (cancelled) return;
        try {
          const items = await listComments({
            streamId: stream.id,
            viewerId: viewer.id,
            isOwner: stream.isMine,
            after: cursor,
          });
          if (items.length > 0) {
            controller.enqueue(
              encoder.encode(`event: comments\ndata: ${JSON.stringify(items)}\n\n`),
            );
            const newest = items[items.length - 1];
            cursor = `${newest.createdAt}|${newest.id}`;
            lastBeat = Date.now();
          } else if (Date.now() - lastBeat > HEARTBEAT_MS) {
            // Without this a proxy closes an idle connection and the
            // chat silently stops updating, with nothing on screen to
            // say so.
            controller.enqueue(encoder.encode(": ping\n\n"));
            lastBeat = Date.now();
          }
        } catch {
          // A transient database blip must not tear down the stream —
          // the next tick tries again. An enqueue on a closed
          // controller throws, which is caught here and stopped below.
          if (cancelled) return;
        }
        if (!cancelled) setTimeout(tick, POLL_MS);
      };

      request.signal.addEventListener("abort", () => {
        cancelled = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });

      void tick();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // nginx buffers proxied responses by default, which holds every
      // event until the buffer fills — the chat then arrives in
      // clumps a minute apart. This is the header that turns it off.
      "X-Accel-Buffering": "no",
    },
  });
}
