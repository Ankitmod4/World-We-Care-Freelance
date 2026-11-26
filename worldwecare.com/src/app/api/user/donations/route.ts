/** GET — the signed-in member's giving history. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listGiven, listReceived } from "@/lib/donations";
import { balanceFor } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const [given, received, balance] = await Promise.all([
    listGiven(auth.id),
    listReceived(auth.id),
    balanceFor(auth.id),
  ]);
  return NextResponse.json({ given, received, balance });
}
