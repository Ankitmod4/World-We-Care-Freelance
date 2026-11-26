/**
 * Donation and payout settings, money arithmetic, and balances.
 *
 * RULES OF THIS FILE
 *
 *  1. Money is an integer number of cents. No floats reach a total. A
 *     percentage is basis points (100 bp = 1%), also an integer.
 *  2. `net` is always derived by SUBTRACTION, never by a second
 *     percentage calculation, so gross = net + fee reconciles exactly
 *     for every input rather than for most of them.
 *  3. Nothing here trusts a client-supplied amount.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getGroup, setSettings } from "./settings";
import { open, seal } from "./secret-box";
import { clampBp, splitFee } from "./money";

// Re-exported so existing importers keep working; the definitions
// moved to ./money so client components can reach them too.
export { clampBp, splitFee, formatCents, parseAmountToCents } from "./money";

export const PAYMENTS_GROUP = "payments";

export interface PaymentSettings {
  /** Master switch. Off = no checkout, no payout requests. */
  enabled: boolean;
  mode: "test" | "live";
  publishableKey: string;
  /** Decrypted. NEVER put this in an API response. */
  secretKey: string;
  webhookSecret: string;
  currency: string;

  /**
   * Whether a recipient is credited the full donation or the donation
   * minus what Stripe charged to process it.
   *
   * "net" by default. With "gross" and a 1% payout fee, a $100
   * donation costs the platform $3.20 in Stripe fees and returns $1 —
   * every donation loses money. That may be a deliberate subsidy, so
   * it's a setting rather than a rule, but the default shouldn't
   * quietly bankrupt anyone.
   */
  creditRecipient: "net" | "gross";

  /** Platform fee on withdrawal, in basis points. 100 = 1%. */
  payoutFeeBasisPoints: number;
  /** Smallest withdrawal, in cents. */
  payoutMinCents: number;
  /** Days a donation is held before it can be withdrawn. */
  payoutHoldDays: number;
  /** Which payout methods members may add. */
  payoutMethods: string[];

  minDonationCents: number;
  maxDonationCents: number;
}

export const PAYMENT_DEFAULTS: PaymentSettings = {
  enabled: false,
  mode: "test",
  publishableKey: "",
  secretKey: "",
  webhookSecret: "",
  currency: "usd",
  creditRecipient: "net",
  payoutFeeBasisPoints: 100, // 1%
  payoutMinCents: 1000, // $10
  payoutHoldDays: 14,
  payoutMethods: ["PAYPAL", "BANK"],
  minDonationCents: 100, // $1 — below this Stripe's 30¢ eats a third of it
  maxDonationCents: 500_000, // $5,000
};

const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;

/** Settings with secrets decrypted. Server-side only. */
export async function getPaymentSettings(): Promise<PaymentSettings> {
  const raw = await getGroup(PAYMENTS_GROUP);
  // getGroup returns FULL dotted keys ("payments.enabled"), matching
  // how storage and email read theirs. Strip the prefix once here
  // rather than repeating it at every lookup.
  const g: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    g[k.startsWith(`${PAYMENTS_GROUP}.`) ? k.slice(PAYMENTS_GROUP.length + 1) : k] = v;
  }
  const d = PAYMENT_DEFAULTS;
  return {
    enabled: typeof g.enabled === "boolean" ? g.enabled : d.enabled,
    mode: g.mode === "live" ? "live" : "test",
    publishableKey: typeof g.publishableKey === "string" ? g.publishableKey : "",
    secretKey: open(typeof g.secretKey === "string" ? g.secretKey : null) ?? "",
    webhookSecret: open(typeof g.webhookSecret === "string" ? g.webhookSecret : null) ?? "",
    currency: typeof g.currency === "string" ? g.currency : d.currency,
    creditRecipient: g.creditRecipient === "gross" ? "gross" : "net",
    payoutFeeBasisPoints: clampBp(num(g.payoutFeeBasisPoints, d.payoutFeeBasisPoints)),
    payoutMinCents: Math.max(0, num(g.payoutMinCents, d.payoutMinCents)),
    payoutHoldDays: Math.max(0, num(g.payoutHoldDays, d.payoutHoldDays)),
    payoutMethods: Array.isArray(g.payoutMethods)
      ? (g.payoutMethods as unknown[]).filter((v): v is string => typeof v === "string")
      : d.payoutMethods,
    minDonationCents: Math.max(50, num(g.minDonationCents, d.minDonationCents)),
    maxDonationCents: Math.max(100, num(g.maxDonationCents, d.maxDonationCents)),
  };
}


/**
 * Refuse a Stripe credential that cannot possibly work.
 *
 * ── WHY THIS EXISTS ──
 *
 * `savePaymentSettings` used to seal and store whatever string it was
 * handed. Anything at all: a fragment of a key, a publishable key
 * pasted into the wrong box, half a clipboard. It encrypted cleanly,
 * saved cleanly, and the settings page then showed a key as
 * configured — so donations were switched on and the button appeared
 * on every event, campaign and broadcast.
 *
 * The first person to find out was a DONOR, who chose an amount,
 * pressed Donate, and got a 502. Nothing in the admin said anything
 * was wrong, and nothing could: from inside, a bad key and a good one
 * look identical until Stripe is asked. A real one cost somebody a
 * donation and left `Invalid API Key provided: 3qisbrznp` in a log
 * nobody was watching.
 *
 * So it is checked at the only moment where the person who can fix it
 * is present, looking at the field, with the value in their hand.
 *
 * ── WHAT IT DOES NOT DO ──
 *
 * It does not ask Stripe. A shape check cannot tell a revoked key
 * from a live one, and it is not meant to — "Test connection" on the
 * settings page does that, and should still be used. This only stops
 * the mistakes that are certain: the wrong field, a truncated paste,
 * a value that was never a key.
 *
 * The prefixes are Stripe's own and stable: `sk_` secret, `rk_`
 * restricted (legitimate, and narrower — worth allowing), `pk_`
 * publishable, `whsec_` webhook signing.
 */
function checkCredential(kind: "secret" | "webhook" | "publishable", raw: string): void {
  const v = raw.trim();

  // The commonest mistake by a distance, and the one whose generic
  // message would waste the most time: the two keys sit next to each
  // other on the page and start with the same two characters.
  const swapped: Record<string, string> = {
    pk_: "publishable key",
    sk_: "secret key",
    rk_: "restricted key",
    whsec_: "webhook signing secret",
  };
  const looksLike = Object.keys(swapped).find((p) => v.startsWith(p));

  const want = {
    secret: { prefixes: ["sk_", "rk_"], name: "secret key", example: "sk_test_…" },
    webhook: { prefixes: ["whsec_"], name: "webhook signing secret", example: "whsec_…" },
    publishable: { prefixes: ["pk_"], name: "publishable key", example: "pk_test_…" },
  }[kind];

  if (want.prefixes.some((p) => v.startsWith(p))) {
    // Right kind, but too short to be whole — a truncated paste.
    // Stripe's own keys are comfortably past this; the bound is
    // deliberately loose so a future format change does not lock
    // somebody out of their own settings page.
    if (v.length < 20) {
      throw new Error(
        `That ${want.name} looks cut off — it is only ${v.length} characters. Copy the whole value from the Stripe dashboard.`,
      );
    }
    return;
  }

  if (looksLike && !want.prefixes.includes(looksLike)) {
    throw new Error(
      `That is a Stripe ${swapped[looksLike]}, not a ${want.name}. Check you are pasting into the right field.`,
    );
  }

  throw new Error(
    `That does not look like a Stripe ${want.name} — they begin "${want.example}". Nothing was saved.`,
  );
}

/** Persist. Secrets are sealed; a blank secret leaves the stored one alone. */
export async function savePaymentSettings(
  input: Partial<Omit<PaymentSettings, "secretKey" | "webhookSecret">> & {
    secretKey?: string;
    webhookSecret?: string;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  for (const k of [
    "enabled", "mode", "publishableKey", "currency", "creditRecipient",
    "payoutMinCents", "payoutHoldDays", "payoutMethods",
    "minDonationCents", "maxDonationCents",
  ] as const) {
    if (input[k] !== undefined) patch[k] = input[k];
  }
  if (input.payoutFeeBasisPoints !== undefined) {
    patch.payoutFeeBasisPoints = clampBp(input.payoutFeeBasisPoints);
  }
  /*
    CHECKED BEFORE ANYTHING IS WRITTEN, all of it, so a bad key in one
    field does not leave the other changes half-applied. The publishable
    key is checked here too rather than at the route: it is the value
    the browser uses, and a wrong one fails in the donor's browser
    instead of the server log, which is even quieter.
  */
  if (typeof patch.publishableKey === "string" && patch.publishableKey.trim()) {
    checkCredential("publishable", patch.publishableKey);
  }
  if (input.secretKey) checkCredential("secret", input.secretKey);
  if (input.webhookSecret) checkCredential("webhook", input.webhookSecret);

  // An empty string means "leave it" — the settings form never receives
  // the real key back, so a blank field is "unchanged", not "clear it".
  if (input.secretKey) patch.secretKey = seal(input.secretKey.trim());
  if (input.webhookSecret) patch.webhookSecret = seal(input.webhookSecret.trim());

  if (Object.keys(patch).length === 0) return;
  await setSettings(
    Object.entries(patch).map(([k, v]) => ({
      key: `${PAYMENTS_GROUP}.${k}`,
      value: v as Prisma.InputJsonValue,
    })),
  );
}

/* ── money ───────────────────────────────────────────────────── */

/* ── balances ────────────────────────────────────────────────── */

export interface Balance {
  /** Matured, not yet reserved or paid. What they can request now. */
  availableCents: number;
  /** Received but still inside the hold period. */
  onHoldCents: number;
  /** Tied up in REQUESTED or APPROVED payouts. */
  reservedCents: number;
  /** Sum of PAID payouts, ever. */
  paidOutCents: number;
  /** Everything credited, ever, net of refunds. */
  lifetimeCents: number;
  currency: string;
}

/**
 * Derived from the rows every time rather than kept as a running
 * column. A materialised balance drifts the first time a webhook is
 * replayed or an admin edits a row by hand, and a wrong balance is
 * worse than a slow one.
 *
 * A refund landing after a payout can push the arithmetic negative.
 * `availableCents` is clamped at zero so nothing offers to pay out a
 * negative, but the true figure is what's used to decide, so the
 * shortfall can't be withdrawn around.
 */
/**
 * `db` lets a caller pass a transaction client.
 *
 * `requestPayout` calls this from inside `$transaction`, which is
 * already holding a pooled connection. Running the three aggregates on
 * the GLOBAL client from in there asks the pool for three more while
 * refusing to release the one it has — about ten concurrent payout
 * requests will hold every connection in the pool waiting for a
 * connection, and the whole application stalls until Prisma's timeout
 * fires. Passing `tx` keeps it all on the one connection.
 */
export async function balanceFor(
  userId: string,
  db: Pick<typeof prisma, "donation" | "payout"> = prisma,
): Promise<Balance> {
  const now = new Date();
  const settings = await getPaymentSettings();

  const [matured, held, payouts] = await Promise.all([
    db.donation.aggregate({
      where: {
        recipientUserId: userId,
        status: { in: ["SUCCEEDED", "REFUNDED"] },
        availableAt: { lte: now },
      },
      _sum: { netCents: true, refundedCents: true },
    }),
    db.donation.aggregate({
      where: {
        recipientUserId: userId,
        status: "SUCCEEDED",
        availableAt: { gt: now },
      },
      _sum: { netCents: true, refundedCents: true },
    }),
    db.payout.groupBy({
      by: ["status"],
      where: { userId, status: { in: ["REQUESTED", "APPROVED", "PAID"] } },
      _sum: { amountCents: true },
    }),
  ]);

  const maturedNet = (matured._sum.netCents ?? 0) - (matured._sum.refundedCents ?? 0);
  const onHold = Math.max(0, (held._sum.netCents ?? 0) - (held._sum.refundedCents ?? 0));

  let reserved = 0;
  let paidOut = 0;
  for (const row of payouts) {
    const sum = row._sum.amountCents ?? 0;
    if (row.status === "PAID") paidOut += sum;
    else reserved += sum;
  }

  return {
    availableCents: Math.max(0, maturedNet - reserved - paidOut),
    onHoldCents: onHold,
    reservedCents: reserved,
    paidOutCents: paidOut,
    lifetimeCents: maturedNet + onHold,
    currency: settings.currency,
  };
}
