/** GET /api/user/messages/unread — { inbox, requests } unread thread counts. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { unreadTotals } from "@/lib/dm";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(await unreadTotals(auth.id));
}
