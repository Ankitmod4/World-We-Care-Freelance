/**
 * GET /api/public/geo/countries
 *
 * Slim active-countries list for the frontend country picker.
 * Public — no auth needed; the picker also renders on the
 * anonymous landing (future) and any country-scoped detail page.
 *
 * Cache header: short public cache so we don't hammer the DB
 * every page load, but changes propagate within a minute.
 */

import { NextResponse } from "next/server";
import { listActiveCountries } from "@/lib/geography";

export async function GET() {
  const rows = await listActiveCountries();
  return NextResponse.json(
    { items: rows },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
