/**
 * GET — active petition categories, with open-petition counts.
 *
 * Under /api/public for the same reason the event one is: a petition
 * is a public argument, the page is readable signed out, and the tiles
 * are part of how a visitor works out what this place is for before
 * they have an account.
 *
 * `countryId` narrows the counts to the list the reader is looking at
 * — a tile saying 12 above a page showing none is the country filter
 * lying about itself.
 */
import { NextRequest, NextResponse } from "next/server";
import { listPublicCategories } from "@/lib/petition-categories";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const countryId = request.nextUrl.searchParams.get("countryId");
  return NextResponse.json({ categories: await listPublicCategories({ countryId }) });
}
