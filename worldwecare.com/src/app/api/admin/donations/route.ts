/** GET — the donations ledger. Money in, to match the payout queue. */
import { NextRequest, NextResponse } from "next/server";
import { requireMoneyAdmin } from "@/lib/admin-auth";
import { listAllDonations, donationTotals } from "@/lib/donations";

export const dynamic = "force-dynamic";

const STATUSES = new Set(["ALL", "PENDING", "SUCCEEDED", "REFUNDED", "DISPUTED", "FAILED"]);

export async function GET(request: NextRequest) {
  const auth = await requireMoneyAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const p = request.nextUrl.searchParams;
  // `status` reaches a Prisma enum column, so it is allow-listed rather
  // than passed through — an unknown value throws a validation error
  // out of the handler and returns a 500 with a stack trace.
  const status = p.get("status") ?? "SUCCEEDED";
  if (!STATUSES.has(status)) {
    return NextResponse.json({ error: "Unknown status." }, { status: 400 });
  }

  const [donations, totals] = await Promise.all([
    listAllDonations({ status, q: p.get("q") ?? undefined, take: Number(p.get("take")) || 50 }),
    donationTotals(),
  ]);
  return NextResponse.json({ donations, totals });
}
