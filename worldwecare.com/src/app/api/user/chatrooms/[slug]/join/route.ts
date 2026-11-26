/** POST /api/user/chatrooms/[slug]/join */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { joinRoom } from "@/lib/chat-user";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await params;
  try {
    const res = await joinRoom({ slug, viewerId: auth.id, userName: auth.displayName, userAvatar: auth.avatarUrl });
    return NextResponse.json({ ok: true, ...res });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Join failed";
    return NextResponse.json({ error: msg }, { status: msg === "Room not found" ? 404 : 400 });
  }
}
