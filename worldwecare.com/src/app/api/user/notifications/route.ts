/** GET /api/user/notifications — list + unread count. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listNotifications } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const sp = new URL(request.url).searchParams;
  const page = await listNotifications(auth.id, {
    cursor: sp.get("cursor"),
    limit: sp.get("limit") ? Number.parseInt(sp.get("limit")!, 10) : undefined,
  });
  return NextResponse.json(page);
}
