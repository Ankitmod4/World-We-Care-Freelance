/** POST /api/user/chatrooms/[slug]/leave */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { leaveRoom } from "@/lib/chat-user";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await params;
  try {
    const res = await leaveRoom({ slug, viewerId: auth.id });
    return NextResponse.json({ ok: true, ...res });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Leave failed";
    return NextResponse.json({ error: msg }, { status: msg === "Room not found" ? 404 : 400 });
  }
}
