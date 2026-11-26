/**
 * GET — the place-type tiles, with counts.
 *
 * Under /api/public because the directory is the part of this site a
 * person in trouble reaches first, often signed out, and the tiles are
 * how they work out what is even on offer.
 *
 * `countryId` narrows the counts to the directory the reader is
 * looking at — a tile saying 12 above a list showing none is the
 * country filter lying about itself.
 */
import { NextRequest, NextResponse } from "next/server";
import { listPlaceTypeTiles } from "@/lib/places";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const countryId = request.nextUrl.searchParams.get("countryId");
  return NextResponse.json({ types: await listPlaceTypeTiles({ countryId }) });
}
