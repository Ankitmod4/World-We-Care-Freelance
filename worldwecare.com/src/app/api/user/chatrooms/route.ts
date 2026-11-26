/** GET /api/user/chatrooms — browse active rooms (+ membership state). */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listRoomsForUser } from "@/lib/chat-user";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const countryId = new URL(request.url).searchParams.get("countryId") ?? undefined;
  const rooms = await listRoomsForUser({ viewerId: auth.id, countryId: countryId || undefined });
  return NextResponse.json({ rooms });
}
