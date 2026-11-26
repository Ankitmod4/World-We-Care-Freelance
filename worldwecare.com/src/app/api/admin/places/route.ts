/** GET list (with the pending count for the nav badge) · POST create. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import type { PlaceTypeValue } from "@/lib/places";
import {
  createPlaceAsAdmin,
  listAdminPlaces,
  type PlaceStatusValue,
  type PlaceWriteInput,
} from "@/lib/places-admin";

export const dynamic = "force-dynamic";
// Creating a place geocodes it, and the rate limiter may make that
// caller wait its turn.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const sp = request.nextUrl.searchParams;
  return NextResponse.json(
    await listAdminPlaces({
      status: (sp.get("status") as PlaceStatusValue | "ALL") ?? "ALL",
      type: (sp.get("type") as PlaceTypeValue | "ALL") ?? "ALL",
      q: sp.get("q") ?? undefined,
      page: Number(sp.get("page")) || 1,
      perPage: Number(sp.get("perPage")) || 25,
    }),
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => ({}))) as PlaceWriteInput;
  try {
    const place = await createPlaceAsAdmin(body, auth.id);
    return NextResponse.json({ ok: true, ...place }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed" },
      { status: 400 },
    );
  }
}
