/**
 * GET /api/admin/notifications/stream
 *
 * Server-Sent Events stream. One long-lived connection per admin
 * tab. Every 5s we re-query the bell payload and push it only if
 * something changed (unread count OR the newest row's id). A
 * heartbeat comment goes out on quiet cycles so proxies don't
 * time-out the connection.
 *
 * Why polling inside SSE instead of a real pub/sub? Simplest possible
 * implementation that works across serverless deploys where multiple
 * server instances would otherwise miss each other's in-memory
 * emitter events. 5s is a reasonable ceiling on notification
 * latency for the admin use case; upgrade to Redis pub/sub later.
 *
 * Runtime: Node (Prisma isn't available on edge). Dynamic so Next
 * doesn't try to prerender it.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getBellPayload } from "@/lib/admin-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_MS = 5_000;
const HEARTBEAT_MS = 20_000;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let cancelled = false;
      let lastUnread = -1;
      let lastLatestId: string | null = null;
      let lastHeartbeat = 0;

      const send = (event: string, data: unknown) => {
        if (cancelled) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          cancelled = true;
        }
      };

      const tick = async () => {
        if (cancelled) return;
        try {
          const payload = await getBellPayload(auth.id);
          const newestId = payload.items[0]?.id ?? null;
          const changed =
            payload.unread !== lastUnread || newestId !== lastLatestId;
          if (changed) {
            send("bell", payload);
            lastUnread = payload.unread;
            lastLatestId = newestId;
            lastHeartbeat = Date.now();
          } else if (Date.now() - lastHeartbeat > HEARTBEAT_MS) {
            // Keep-alive comment — no event name, ignored by
            // EventSource but stops the connection from being
            // reaped by intermediaries.
            try {
              controller.enqueue(encoder.encode(`: keep-alive\n\n`));
            } catch {
              cancelled = true;
            }
            lastHeartbeat = Date.now();
          }
        } catch (err) {
          console.warn("[notif-stream] tick failed:", err);
        }
      };

      // First push happens immediately so the badge is correct on
      // page load without waiting a full poll cycle.
      await tick();
      const interval = setInterval(tick, POLL_MS);

      request.signal.addEventListener("abort", () => {
        cancelled = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Nginx-friendly — disables response buffering so events
      // reach the browser as soon as we push.
      "X-Accel-Buffering": "no",
    },
  });
}
