/**
 * GET /api/user/follow/suggestions — the right rail's "Who to follow".
 *
 * Signed-in only, and scoped to the caller: every exclusion (already
 * followed, blocked either way) is computed from the session, never
 * from a query parameter, so one member cannot ask for another's
 * suggestions.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { suggestFollows } from "@/lib/follows";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json({ people: await suggestFollows(auth.id, 3) });
  } catch {
    // A sidebar card is not worth a 500 on the page it sits on.
    return NextResponse.json({ people: [] });
  }
}
