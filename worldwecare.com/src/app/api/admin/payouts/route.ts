/** GET — the payout queue. */
import { NextRequest, NextResponse } from "next/server";
import { requireMoneyAdmin } from "@/lib/admin-auth";
import { listAllPayouts, payoutTotals } from "@/lib/payouts";

export const dynamic = "force-dynamic";

// Reaches a Prisma enum column; an unknown value throws out of the
// handler as a 500 rather than a 400.
const STATUSES = new Set(["ALL", "REQUESTED", "APPROVED", "PAID", "REJECTED", "CANCELLED"]);

export async function GET(request: NextRequest) {
  const auth = await requireMoneyAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const p = request.nextUrl.searchParams;
  const status = p.get("status") ?? "REQUESTED";
  if (!STATUSES.has(status)) {
    return NextResponse.json({ error: "Unknown status." }, { status: 400 });
  }
  const [payouts, totals] = await Promise.all([
    listAllPayouts({
      status,
      q: p.get("q") ?? undefined,
      take: Number(p.get("take")) || 50,
    }),
    payoutTotals(),
  ]);
  return NextResponse.json({ payouts, totals });
}
