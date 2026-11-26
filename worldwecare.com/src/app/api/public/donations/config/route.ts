/**
 * GET — is donating switched on, and what are the limits.
 *
 * Public and under /api/public because a signed-out visitor sees the
 * donate button too, and that path is already exempt from the
 * email-verification gate. Carries no secrets — the amounts here are
 * the same ones the checkout endpoint re-checks server-side, so this
 * is a hint for the UI rather than something to trust.
 */
import { NextResponse } from "next/server";
import { getPaymentSettings } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const s = await getPaymentSettings();
    return NextResponse.json({
      enabled: s.enabled && !!s.secretKey,
      minCents: s.minDonationCents,
      maxCents: s.maxDonationCents,
      currency: s.currency,
    });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
