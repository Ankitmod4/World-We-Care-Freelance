/** POST /api/user/chatrooms/[slug]/messages/[id]/react — toggle a reaction. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { toggleReaction } from "@/lib/chat-user";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as { emoji?: unknown };
  if (typeof b.emoji !== "string") return NextResponse.json({ error: "Emoji required" }, { status: 400 });
  try {
    const res = await toggleReaction(auth.id, id, b.emoji);
    return NextResponse.json({ ok: true, ...res });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "React failed";
    return NextResponse.json({ error: msg }, { status: msg === "Message not found" ? 404 : 400 });
  }
}
