/**
 * GET /api/user/chatrooms/[slug]/stream — Server-Sent Events.
 *
 * One long-lived connection per open room. Every 2.5s we query
 * messages newer than the cursor and push them; a heartbeat comment
 * goes out on quiet cycles. Polling-inside-SSE (same approach as the
 * admin bell) — good enough for near-real-time without a pub/sub bus.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { getRoomForUser, listMessages } from "@/lib/chat-user";
import { getBlockedIds } from "@/lib/blocks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_MS = 2500;
const HEARTBEAT_MS = 20_000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await params;
  const room = await getRoomForUser({ viewerId: auth.id, slug });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (!room.canRead) return NextResponse.json({ error: "Locked" }, { status: 403 });

  const sp = new URL(request.url).searchParams;
  // A (createdAt, id) cursor string, not a Date. Resuming from a bare
  // timestamp is what let a message sharing the boundary millisecond
  // slip past the poll and never arrive — see @/lib/cursor.
  let cursor = sp.get("after") ?? new Date().toISOString();
  const blockedIds = await getBlockedIds(auth.id);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let cancelled = false;
      let lastBeat = Date.now();
      const send = (event: string, data: unknown) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cancelled = true;
        }
      };
      const tick = async () => {
        if (cancelled) return;
        try {
          const page = await listMessages({
            roomId: room.id,
            viewerId: auth.id,
            after: cursor,
            blockedIds,
          });
          if (page.items.length > 0) {
            send("messages", page.items);
            // From the library, which knows the id of the row it
            // stopped on. Re-deriving this from the last item's
            // timestamp is exactly the bug.
            cursor = page.afterCursor ?? cursor;
            lastBeat = Date.now();
          } else if (Date.now() - lastBeat > HEARTBEAT_MS) {
            try {
              controller.enqueue(encoder.encode(": ping\n\n"));
            } catch {
              cancelled = true;
            }
            lastBeat = Date.now();
          }
        } catch {
          /* transient — try again next tick */
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

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
