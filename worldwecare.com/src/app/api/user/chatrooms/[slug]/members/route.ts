/** GET /api/user/chatrooms/[slug]/members — roster for the "who's here" panel. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { getRoomForUser, listRoomMembers } from "@/lib/chat-user";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await params;
  const room = await getRoomForUser({ viewerId: auth.id, slug });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (!room.canRead) return NextResponse.json({ error: "Locked", locked: true }, { status: 403 });
  return NextResponse.json({ members: await listRoomMembers(room.id) });
}
