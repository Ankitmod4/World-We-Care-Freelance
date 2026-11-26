/**
 * POST — approve, reject or cancel an event.
 *
 * Approving also creates the event's chatroom; cancelling notifies
 * everyone who had RSVP'd.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { cancelEvent, reviewEvent } from "@/lib/events";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string; reason?: string };

  try {
    if (body.action === "cancel") {
      return NextResponse.json({ ok: true, ...(await cancelEvent(id, auth.id)) });
    }
    if (body.action !== "approve" && body.action !== "reject") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...(await reviewEvent(id, auth.id, body.action, body.reason)) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Review failed";
    return NextResponse.json({ error: msg }, { status: msg === "Event not found" ? 404 : 400 });
  }
}
