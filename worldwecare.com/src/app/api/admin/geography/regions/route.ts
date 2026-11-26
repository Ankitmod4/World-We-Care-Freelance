/**
 * GET  /api/admin/geography/regions — list (search)
 * POST /api/admin/geography/regions — create
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createRegion, listRegions } from "@/lib/geography-admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const q = new URL(request.url).searchParams.get("q") ?? undefined;
  const items = await listRegions(q);
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    code?: string;
    slug?: string;
    sortOrder?: number;
    isActive?: boolean;
  };
  if (!body.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!body.code?.trim()) return NextResponse.json({ error: "Code is required" }, { status: 400 });
  try {
    await createRegion({
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
