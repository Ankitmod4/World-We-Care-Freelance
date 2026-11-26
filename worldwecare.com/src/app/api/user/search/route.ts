/** GET /api/user/search?q=…&countryId=… — everything matching, capped. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { searchEverything } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const sp = request.nextUrl.searchParams;
  return NextResponse.json(
    await searchEverything(sp.get("q") ?? "", {
      countryId: sp.get("countryId"),
      // Needed so blocked members are left out, and so the viewer
      // doesn't turn up in their own results.
      viewerId: auth.id,
    }),
  );
}
