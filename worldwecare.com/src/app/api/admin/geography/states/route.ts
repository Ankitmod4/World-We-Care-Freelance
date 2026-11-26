/**
 * GET  /api/admin/geography/states — list (US only in practice)
 * POST /api/admin/geography/states — create (must target US)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  createState,
  getUsCountryId,
  listStates,
} from "@/lib/geography-admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  const statusRaw = params.get("status") ?? "all";
  const status: "all" | "active" | "inactive" =
    statusRaw === "active" || statusRaw === "inactive" ? statusRaw : "all";
  // Default to United States if the caller didn't specify one — the
  // States tab is US-scoped in the current product.
  const countryId = params.get("countryId") ?? (await getUsCountryId()) ?? undefined;
  const items = await listStates({
    q: params.get("q") ?? undefined,
    countryId,
    status,
  });
  return NextResponse.json({ items, countryId });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const countryId =
    typeof body.countryId === "string" && body.countryId
      ? body.countryId
      : ((await getUsCountryId()) ?? "");
  const name = typeof body.name === "string" ? body.name : "";
  const code = typeof body.code === "string" ? body.code : "";
  if (!countryId) return NextResponse.json({ error: "United States row missing — seed geography first." }, { status: 400 });
  if (!name.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!code.trim()) return NextResponse.json({ error: "Code is required" }, { status: 400 });
  try {
    await createState({
      countryId,
      name,
      code,
      slug: typeof body.slug === "string" ? body.slug : undefined,
      capital: typeof body.capital === "string" ? body.capital : undefined,
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
