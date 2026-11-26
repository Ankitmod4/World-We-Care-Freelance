/**
 * GET /api/user/messages/conversations/[id]/stream — SSE for one thread.
 * Polls for new messages + the other side's read/typing state.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { pollThread } from "@/lib/dm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_MS = 2000;
const HEARTBEAT_MS = 20_000;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const sp = new URL(request.url).searchParams;
  let cursor = sp.get("after") ? new Date(sp.get("after")!) : new Date();
  let lastReadSent = "";
  let lastTyping = false;
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
          const res = await pollThread(auth.id, id, cursor);
          if (res === null) { cancelled = true; return; }
          if (res.messages.length > 0) {
            send("messages", res.messages);
            cursor = new Date(res.messages[res.messages.length - 1].createdAt);
            lastBeat = Date.now();
          }
          const readStr = res.otherLastReadAt ?? "";
          if (readStr !== lastReadSent) {
            lastReadSent = readStr;
            send("seen", { otherLastReadAt: res.otherLastReadAt });
            lastBeat = Date.now();
          }
          if (res.otherTyping !== lastTyping) {
            lastTyping = res.otherTyping;
            send("typing", { typing: res.otherTyping });
            lastBeat = Date.now();
          }
          if (Date.now() - lastBeat > HEARTBEAT_MS) {
            try { controller.enqueue(encoder.encode(": ping\n\n")); } catch { cancelled = true; }
            lastBeat = Date.now();
          }
        } catch {
          /* keep the stream alive on transient errors */
        }
        if (!cancelled) setTimeout(tick, POLL_MS);
      };
      void tick();
      request.signal.addEventListener("abort", () => { cancelled = true; try { controller.close(); } catch {} });
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
