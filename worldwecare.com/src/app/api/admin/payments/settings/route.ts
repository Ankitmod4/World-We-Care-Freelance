/** GET / PUT the Stripe and payout settings. */
import { NextRequest, NextResponse } from "next/server";
import { requireMoneyAdmin } from "@/lib/admin-auth";
import { getPaymentSettings, savePaymentSettings } from "@/lib/payments";
import { maskSecret, secretsConfigured } from "@/lib/secret-box";

export const dynamic = "force-dynamic";

/**
 * Secrets go out MASKED, always.
 *
 * The form shows "sk_live_51H…9xQm" and posts an empty string when the
 * admin hasn't retyped it, which savePaymentSettings reads as "leave
 * it alone". A settings page that round-trips the real key turns any
 * XSS or leaked admin session into a compromised Stripe account.
 */
export async function GET(request: NextRequest) {
  const auth = await requireMoneyAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const s = await getPaymentSettings();
  return NextResponse.json({
    settings: {
      enabled: s.enabled,
      mode: s.mode,
      publishableKey: s.publishableKey,
      currency: s.currency,
      creditRecipient: s.creditRecipient,
      payoutFeeBasisPoints: s.payoutFeeBasisPoints,
      payoutMinCents: s.payoutMinCents,
      payoutHoldDays: s.payoutHoldDays,
      payoutMethods: s.payoutMethods,
      minDonationCents: s.minDonationCents,
      maxDonationCents: s.maxDonationCents,
      // Presence + shape only.
      secretKeyMasked: maskSecret(s.secretKey),
      webhookSecretMasked: maskSecret(s.webhookSecret),
      hasSecretKey: !!s.secretKey,
      hasWebhookSecret: !!s.webhookSecret,
    },
    // Without an encryption key nothing can be stored safely, and the
    // form says so instead of failing on save.
    encryptionReady: secretsConfigured(),
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireMoneyAdmin(request, "owner");
  if (auth instanceof NextResponse) return auth;

  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (!secretsConfigured()) {
    return NextResponse.json(
      { error: "Set PAYMENTS_SECRET on the server before saving Stripe keys." },
      { status: 400 },
    );
  }

  const asInt = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? Math.round(v) : undefined;

  try {
    await savePaymentSettings({
      enabled: typeof b.enabled === "boolean" ? b.enabled : undefined,
      mode: b.mode === "live" ? "live" : b.mode === "test" ? "test" : undefined,
      publishableKey: typeof b.publishableKey === "string" ? b.publishableKey.trim() : undefined,
      creditRecipient:
        b.creditRecipient === "gross" ? "gross" : b.creditRecipient === "net" ? "net" : undefined,
      payoutFeeBasisPoints: asInt(b.payoutFeeBasisPoints),
      payoutMinCents: asInt(b.payoutMinCents),
      payoutHoldDays: asInt(b.payoutHoldDays),
      payoutMethods: Array.isArray(b.payoutMethods)
        ? (b.payoutMethods as unknown[]).filter((v): v is string => typeof v === "string")
        : undefined,
      minDonationCents: asInt(b.minDonationCents),
      maxDonationCents: asInt(b.maxDonationCents),
      // Blank = unchanged. Only a real value replaces what's stored.
      secretKey: typeof b.secretKey === "string" && b.secretKey.trim() ? b.secretKey : undefined,
      webhookSecret:
        typeof b.webhookSecret === "string" && b.webhookSecret.trim() ? b.webhookSecret : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't save those settings." },
      { status: 400 },
    );
  }
}
