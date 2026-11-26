/** GET — my own streams, and whether I can start another. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listMine, whyNotAllowed } from "@/lib/live-streams";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const [streams, blocked] = await Promise.all([
    listMine(auth.id),
    whyNotAllowed(auth.id),
  ]);
  return NextResponse.json({ streams, blockedReason: blocked });
}
