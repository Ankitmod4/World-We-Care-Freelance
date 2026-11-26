/** GET the signed-in member's journey stats. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { getJourneyStats } from "@/lib/profile";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ stats: await getJourneyStats(auth.id) });
}
