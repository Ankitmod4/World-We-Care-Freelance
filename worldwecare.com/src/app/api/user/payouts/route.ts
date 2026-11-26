/** GET — balance, methods and payout history · POST — request one. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { balanceFor, getPaymentSettings } from "@/lib/payments";
import { listMethods, listPayouts, requestPayout } from "@/lib/payouts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const [balance, methods, payouts, settings] = await Promise.all([
    balanceFor(auth.id),
    listMethods(auth.id),
    listPayouts(auth.id),
    getPaymentSettings(),
  ]);

  return NextResponse.json({
    balance,
    methods,
    payouts,
    // Only the fields the withdrawal form needs. Nothing secret.
    limits: {
      enabled: settings.enabled,
      minCents: settings.payoutMinCents,
      feeBasisPoints: settings.payoutFeeBasisPoints,
      holdDays: settings.payoutHoldDays,
      currency: settings.currency,
      allowedMethods: settings.payoutMethods,
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await requestPayout(
    auth.id,
    Number(b.amountCents),
    String(b.methodId ?? ""),
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
