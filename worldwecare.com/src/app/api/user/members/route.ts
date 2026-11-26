/**
 * GET /api/user/members — the directory behind /members.
 *
 * Signed-in only. `q`, `country` and `cursor` come from the query
 * string; the exclusions (yourself, blocks either way) are computed
 * from the session, so they cannot be turned off by a caller.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listMembers } from "@/lib/follows";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const sp = request.nextUrl.searchParams;
  try {
    const page = await listMembers({
      viewerId: auth.id,
      q: sp.get("q"),
      countryId: sp.get("country"),
      cursor: sp.get("cursor"),
      limit: Number(sp.get("limit")) || 24,
    });
    return NextResponse.json(page);
  } catch {
    return NextResponse.json({ items: [], nextCursor: null });
  }
}
