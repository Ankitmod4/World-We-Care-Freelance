/** GET messages of a room for moderation (?status=all|published|pending|removed). */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listMessagesAdmin } from "@/lib/chat-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const raw = new URL(request.url).searchParams.get("status") ?? "all";
  const status =
    raw === "published" || raw === "pending" || raw === "removed" || raw === "reported"
      ? raw
      : "all";
  return NextResponse.json({ messages: await listMessagesAdmin(id, { status }) });
}
