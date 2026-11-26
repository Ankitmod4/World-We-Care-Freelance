/**
 * GET /api/admin/notifications
 *
 * Returns the bell payload — the caller's unread count + latest N
 * notifications. Used by the dropdown on open (freshest possible
 * data) AND by the SSE stream as its poll query.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getBellPayload } from "@/lib/admin-notifications";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const payload = await getBellPayload(auth.id);
  return NextResponse.json(payload);
}
