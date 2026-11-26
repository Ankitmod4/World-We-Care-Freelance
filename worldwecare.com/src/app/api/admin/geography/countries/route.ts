/**
 * GET  /api/admin/geography/countries — paginated list (search + filters)
 * POST /api/admin/geography/countries — create
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createCountry, listCountries } from "@/lib/geography-admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  const statusRaw = params.get("status") ?? "all";
  const status: "all" | "active" | "inactive" =
    statusRaw === "active" || statusRaw === "inactive" ? statusRaw : "all";
  const result = await listCountries({
    q: params.get("q") ?? undefined,
    regionId: params.get("regionId") ?? undefined,
    subRegionId: params.get("subRegionId") ?? undefined,
    status,
    page: Number.parseInt(params.get("page") ?? "1", 10),
    perPage: Number.parseInt(params.get("perPage") ?? "50", 10),
  });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const subRegionId = typeof body.subRegionId === "string" ? body.subRegionId : "";
  const name = typeof body.name === "string" ? body.name : "";
  const code = typeof body.code === "string" ? body.code : "";
  if (!subRegionId) return NextResponse.json({ error: "Sub-region is required" }, { status: 400 });
  if (!name.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!code.trim()) return NextResponse.json({ error: "Code is required" }, { status: 400 });
  try {
    await createCountry({
      subRegionId,
      name,
      code,
      slug: typeof body.slug === "string" ? body.slug : undefined,
      code3: typeof body.code3 === "string" ? body.code3 : undefined,
      numericCode: typeof body.numericCode === "string" ? body.numericCode : undefined,
      flagUrl: typeof body.flagUrl === "string" ? body.flagUrl : undefined,
      emojiFlag: typeof body.emojiFlag === "string" ? body.emojiFlag : undefined,
      phoneCode: typeof body.phoneCode === "string" ? body.phoneCode : undefined,
      currency: typeof body.currency === "string" ? body.currency : undefined,
      language: typeof body.language === "string" ? body.language : undefined,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed" },
      { status: 400 },
    );
  }
}
