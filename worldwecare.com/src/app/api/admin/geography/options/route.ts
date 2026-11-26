/**
 * GET /api/admin/geography/options
 *   ?level=regions
 *   ?level=sub-regions[&regionId=...]
 *   ?level=countries
 * — slim option lists for pickers in the admin modals.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  listCountryOptions,
  listRegionOptions,
  listSubRegionOptions,
} from "@/lib/geography-admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  const level = params.get("level");
  if (level === "regions") {
    return NextResponse.json({ items: await listRegionOptions() });
  }
  if (level === "sub-regions") {
    const regionId = params.get("regionId") ?? undefined;
    return NextResponse.json({ items: await listSubRegionOptions(regionId) });
  }
  if (level === "countries") {
    return NextResponse.json({ items: await listCountryOptions() });
  }
  return NextResponse.json({ error: "Unknown level" }, { status: 400 });
}
