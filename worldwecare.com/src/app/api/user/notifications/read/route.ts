/** POST /api/user/notifications/read — { ids?: string[] } (omit to mark all read). */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { markNotificationsRead } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const b = (await request.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === "string") : undefined;
  await markNotificationsRead(auth.id, ids);
  return NextResponse.json({ ok: true });
}
