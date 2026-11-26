/**
 * POST /api/admin/notifications/read
 *
 * Body:
 *   { ids: string[] } — mark those rows as read
 *   { all: true }     — mark every unread row as read
 *
 * Returns { updated: number } so the client can adjust its badge
 * count without a fresh fetch.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { markRead } from "@/lib/admin-notifications";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => ({}))) as {
    ids?: unknown;
    all?: unknown;
  };
  if (body.all === true) {
    const updated = await markRead(auth.id, "all");
    return NextResponse.json({ updated });
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((v) => typeof v === "string")
    : [];
  const updated = await markRead(auth.id, ids as string[]);
  return NextResponse.json({ updated });
}
