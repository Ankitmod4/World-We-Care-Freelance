/** PATCH moderate (approve/remove/restore/pin/unpin) · DELETE hard-delete. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { hardDeleteMessage, moderateMessage } from "@/lib/chat-admin";

const ACTIONS = ["approve", "remove", "restore", "pin", "unpin"] as const;
type Action = (typeof ACTIONS)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { messageId } = await params;
  const b = (await request.json().catch(() => ({}))) as { action?: unknown; reason?: unknown };
  if (typeof b.action !== "string" || !ACTIONS.includes(b.action as Action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  try {
    await moderateMessage(messageId, b.action as Action, typeof b.reason === "string" ? b.reason : undefined);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Action failed" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { messageId } = await params;
  try {
    await hardDeleteMessage(messageId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed" }, { status: 400 });
  }
}
