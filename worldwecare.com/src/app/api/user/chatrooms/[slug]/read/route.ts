/** POST /api/user/chatrooms/[slug]/read — mark the room read up to now. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { markRoomRead } from "@/lib/chat-user";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await params;
  await markRoomRead(auth.id, slug);
  return NextResponse.json({ ok: true });
}
