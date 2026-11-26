/**
 * GET — active campaign categories, with live-campaign counts.
 *
 * Sits next to /api/public/petition-categories and behaves the same
 * way. The campaigns page itself requires an account today, but the
 * tiles are the part most likely to be wanted signed-out later, and
 * splitting one taxonomy endpoint across two auth models would be the
 * kind of difference nobody remembers.
 *
 * `countryId` narrows the counts to the list the reader is looking at
 * — a tile saying 12 above a page showing none is the country filter
 * lying about itself.
 */
import { NextRequest, NextResponse } from "next/server";
import { listPublicCategories } from "@/lib/campaign-categories";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const countryId = request.nextUrl.searchParams.get("countryId");
  return NextResponse.json({ categories: await listPublicCategories({ countryId }) });
}
