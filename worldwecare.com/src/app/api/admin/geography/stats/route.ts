/**
 * GET /api/admin/geography/stats — overview counts for the hub page.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getGeographyStats } from "@/lib/geography-admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const stats = await getGeographyStats();
  return NextResponse.json(stats);
}
