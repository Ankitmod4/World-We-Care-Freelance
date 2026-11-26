/**
 * GET — active event categories, with upcoming counts.
 *
 * Under /api/public because the calendar is readable signed out, and
 * because the chips have to render before anyone has an account —
 * they are part of how a visitor works out what this place does.
 */
import { NextRequest, NextResponse } from "next/server";
import { listPublicCategories } from "@/lib/event-categories";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const countryId = request.nextUrl.searchParams.get("countryId");
  return NextResponse.json({ categories: await listPublicCategories({ countryId }) });
}
