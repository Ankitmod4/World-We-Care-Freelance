/**
 * PATCH  — edit own | report | moderator action (pin/unpin/remove/approve)
 * DELETE — author deletes own message
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { isValidReason } from "@/lib/posts-user";
import {
  deleteOwnMessage,
  editOwnMessage,
  modApproveMessage,
  modPinMessage,
  modRemoveMessage,
  reportMessage,
} from "@/lib/chat-user";

function statusFor(msg: string): number {
  if (msg === "Message not found") return 404;
  if (msg === "Not your message" || msg === "Moderators only") return 403;
  return 400;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as {
    action?: unknown;
    body?: unknown;
    reason?: unknown;
    notes?: unknown;
  };
  try {
    switch (b.action) {
      case "edit": {
        if (typeof b.body !== "string") return NextResponse.json({ error: "Body required" }, { status: 400 });
        const message = await editOwnMessage(auth.id, id, b.body);
        return NextResponse.json({ ok: true, message });
      }
      case "report": {
        if (!isValidReason(b.reason)) return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
        const res = await reportMessage({
          viewerId: auth.id,
          messageId: id,
          reason: b.reason,
          notes: typeof b.notes === "string" ? b.notes : undefined,
        });
        return NextResponse.json({ ok: true, ...res });
      }
      case "pin":
      case "unpin":
        await modPinMessage(auth.id, id, b.action === "pin");
        return NextResponse.json({ ok: true });
      case "remove":
        await modRemoveMessage(auth.id, id);
        return NextResponse.json({ ok: true });
      case "approve":
        await modApproveMessage(auth.id, id);
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Action failed";
    return NextResponse.json({ error: msg }, { status: statusFor(msg) });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await deleteOwnMessage(auth.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: statusFor(msg) });
  }
}
