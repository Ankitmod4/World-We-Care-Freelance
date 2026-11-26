/**
 * GET  /api/admin/geography/sub-regions — list (search, ?regionId= filter)
 * POST /api/admin/geography/sub-regions — create
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createSubRegion, listSubRegions } from "@/lib/geography-admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  const items = await listSubRegions({
    q: params.get("q") ?? undefined,
    regionId: params.get("regionId") ?? undefined,
  });
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => ({}))) as {
    regionId?: string;
    name?: string;
    code?: string;
    slug?: string;
    sortOrder?: number;
    isActive?: boolean;
  };
  if (!body.regionId) return NextResponse.json({ error: "Region is required" }, { status: 400 });
  if (!body.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!body.code?.trim()) return NextResponse.json({ error: "Code is required" }, { status: 400 });
  try {
    await createSubRegion({
      regionId: body.regionId,
      name: body.name,
      code: body.code,
      slug: body.slug,
      sortOrder: body.sortOrder,
      isActive: body.isActive,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed" },
      { status: 400 },
    );
  }
}
