/**
 * GET  — the directory, filtered. Serves both views: the list passes a
 *        page, the map passes a viewport (`lat`/`lng`/`km`).
 * POST — a member submits a place; it lands in the admin queue.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/user-auth";
import { listPlaces, PLACE_TYPES, type PlaceTypeValue } from "@/lib/places";
import { submitPlace, type PlaceWriteInput } from "@/lib/places-admin";

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set(PLACE_TYPES.map((t) => t.value));

function typesFrom(raw: string | null): PlaceTypeValue[] | undefined {
  if (!raw) return undefined;
  const picked = raw
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter((t): t is PlaceTypeValue => VALID_TYPES.has(t as PlaceTypeValue));
  return picked.length ? picked : undefined;
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const sp = request.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const km = Number(sp.get("km"));

  return NextResponse.json(
    await listPlaces({
      types: typesFrom(sp.get("types")),
      donorOnly: sp.get("donorOnly") === "1",
      countryId: sp.get("countryId"),
      stateId: sp.get("stateId"),
      savedOnly: sp.get("saved") === "1",
      q: sp.get("q") ?? undefined,
      // A viewport bigger than a continent is a client bug, not a
      // request worth serving — clamp rather than scan the table.
      near:
        Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(km)
          ? { lat, lng, km: Math.min(2000, Math.max(1, km)) }
          : null,
      mappableOnly: sp.get("mappable") === "1",
      page: Number(sp.get("page")) || 1,
      perPage: Number(sp.get("perPage")) || 50,
      viewerId: auth.id,
    }),
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  // Same bar as submitting an event: an unverified account shouldn't
  // be able to put an address in front of the whole community.
  const viewer = await getCurrentUser();
  if (!viewer?.emailVerifiedAt) {
    return NextResponse.json(
      { error: "Verify your email address before adding a place." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as PlaceWriteInput;
  try {
    const place = await submitPlace(body, { id: auth.id, displayName: auth.displayName });
    return NextResponse.json({ ok: true, ...place }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not add the place" },
      { status: 400 },
    );
  }
}
