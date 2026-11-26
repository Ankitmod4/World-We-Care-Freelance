/** GET /api/public/town-hero-categories — active categories with counts. */
import { NextRequest, NextResponse } from "next/server";
import { listPublicHeroCategories } from "@/lib/town-hero-categories";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categories = await listPublicHeroCategories(searchParams.get("countryId"));
  return NextResponse.json({ categories });
}
