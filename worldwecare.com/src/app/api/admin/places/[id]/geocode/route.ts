/**
 * POST — re-run the address lookup for one place.
 *
 * Deliberately one place at a time and admin-triggered. There is no
 * "geocode everything" button, and there should not be: Nominatim
 * allows about one request a second, so a bulk run over a directory is
 * how the whole app gets blocked.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { regeocodePlace } from "@/lib/places-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const coords = await regeocodePlace(id);
    return NextResponse.json({ ok: !coords.geocodeError, ...coords });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lookup failed" },
      { status: 400 },
    );
  }
}
