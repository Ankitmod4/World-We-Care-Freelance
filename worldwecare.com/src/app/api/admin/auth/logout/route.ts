/**
 * POST /api/admin/auth/logout — clears the admin cookie.
 *
 * Uses POST rather than GET so a stray <img src=".../logout"/> in a
 * hostile email can't sign an admin out (browsers won't preflight a
 * GET as CSRF, but POST from a foreign origin needs a form or CORS).
 */

import { NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/admin-auth";

export async function POST() {
  await clearAdminCookie();
  return NextResponse.json({ ok: true });
}
