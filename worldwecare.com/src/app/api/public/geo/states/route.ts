/**
 * GET /api/public/geo/states?countryId=…
 *
 * The regions of one country, for the directory's region filter and the
 * admin place form. Public and cacheable for the same reason the country
 * list is: it changes about once a decade and every page load wants it.
 *
 * No countryId means no answer — an unfiltered list of every state in
 * every country is a payload nobody has a use for.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const countryId = request.nextUrl.searchParams.get("countryId");
  if (!countryId) return NextResponse.json({ items: [] });

  const rows = await prisma.state.findMany({
    where: { countryId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, slug: true },
  });
  return NextResponse.json(
    { items: rows },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
