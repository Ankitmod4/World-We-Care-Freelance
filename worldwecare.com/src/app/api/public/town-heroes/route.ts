/**
 * GET /api/public/town-heroes — approved heroes for the home strip.
 *
 * Public rather than under /api/user because the strip renders for a
 * signed-out visitor on the landing page too, and because it returns
 * nothing a reader could not already see on /town-heroes.
 */
import { NextRequest, NextResponse } from "next/server";
import { listHeroHighlights } from "@/lib/town-heroes";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const heroes = await listHeroHighlights(
    searchParams.get("countryId"),
    Number(searchParams.get("take")) || 6,
  );
  return NextResponse.json({ heroes });
}
