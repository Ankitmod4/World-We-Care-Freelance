/**
 * Why isn't a donation showing up?
 *
 *   npm run donations:check     # report only, changes nothing
 *   npm run donations:sweep     # mark dead attempts FAILED
 *
 * A donation only appears in a member's history once the Stripe
 * WEBHOOK has marked it SUCCEEDED. The browser redirect to
 * /donate/thanks deliberately credits nothing — the redirect is under
 * the donor's control and a webhook is not, so the money is only ever
 * believed on Stripe's word.
 *
 * That design has one failure mode, and in local development it is the
 * usual one: the payment succeeds at Stripe, no webhook is delivered,
 * and the row sits at PENDING forever — invisible in the member's
 * history and in the balance. This script says which of those you are
 * looking at. It reads only; it writes nothing, and it never prints a
 * secret's value.
 */

import { PrismaClient } from "@prisma/client";
import { getGroup } from "../src/lib/settings";
import { getPaymentSettings } from "../src/lib/payments";
import { canDecrypt, secretsConfigured } from "../src/lib/secret-box";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const ago = (d: Date) => {
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

async function main() {
  /* ── 1. is the payments system actually configured? ───────────── */
  // Read it BOTH ways. `getPaymentSettings` decrypts; the raw group
  // says whether ciphertext exists at all. The gap between the two is
  // its own failure: a secret that is stored but no longer decryptable
  // because PAYMENTS_SECRET changed. That reads as "not configured"
  // everywhere in the app, with nothing anywhere saying why.
  const raw = await getGroup("payments");
  const cfg = await getPaymentSettings();
  const sealed = (k: string) => {
    const v = raw[`payments.${k}`];
    return typeof v === "string" && v.length > 0 ? v : null;
  };
  const secretState = (k: string, plain: string) => {
    const c = sealed(k);
    if (!c) return "NOT SET";
    if (!canDecrypt(c)) return "STORED BUT UNREADABLE — PAYMENTS_SECRET has changed since it was saved";
    return plain ? "set" : "STORED BUT EMPTY";
  };

  console.log("\n── settings ──────────────────────────────────────");
  console.log("  PAYMENTS_SECRET in env ", secretsConfigured() ? "yes" : "NO  ← nothing can be sealed or opened");
  console.log("  donations enabled      ", cfg.enabled ? "yes" : "NO  ← checkout refuses every request");
  console.log("  mode                   ", cfg.mode);
  console.log("  secret key             ", secretState("secretKey", cfg.secretKey));
  console.log("  WEBHOOK SECRET         ", secretState("webhookSecret", cfg.webhookSecret));
  console.log("  credit recipient       ", cfg.creditRecipient);
  console.log("  hold days              ", cfg.payoutHoldDays);
  console.log("  currency               ", cfg.currency);
  console.log("  donation limits        ", `${money(cfg.minDonationCents)} – ${money(cfg.maxDonationCents)}`);

  /* ── 2. what state are the donations in? ──────────────────────── */
  const byStatus = await prisma.donation.groupBy({
    by: ["status"],
    _count: { _all: true },
    _sum: { grossCents: true },
  });

  console.log("\n── donations by status ───────────────────────────");
  if (byStatus.length === 0) {
    console.log("  (no donation rows at all — checkout never got as far as creating one)");
  }
  for (const g of byStatus) {
    console.log(`  ${String(g.status).padEnd(10)} ${String(g._count._all).padStart(4)}   ${money(g._sum.grossCents ?? 0)}`);
  }

  /* ── 3. the last ten, in detail ───────────────────────────────── */
  const recent = await prisma.donation.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true, status: true, grossCents: true, netCents: true, stripeFeeCents: true,
      donorUserId: true, donorEmail: true, recipientUserId: true, eventId: true,
      stripeSessionId: true, stripePaymentIntentId: true,
      createdAt: true, succeededAt: true, availableAt: true, causeTitleSnapshot: true,
    },
  });

  console.log("\n── the last ten ──────────────────────────────────");
  for (const d of recent) {
    console.log(`\n  ${d.id}  ${d.status}   ${money(d.grossCents)}   ${ago(d.createdAt)}`);
    console.log(`    cause      ${d.causeTitleSnapshot ?? "(none)"}${d.eventId ? `  event=${d.eventId}` : ""}`);
    console.log(`    donor      ${d.donorUserId ?? "SIGNED OUT — will not appear in anyone's history"}  ${d.donorEmail ?? ""}`);
    console.log(`    recipient  ${d.recipientUserId ?? "(the charity — no member is credited)"}`);
    console.log(`    session    ${d.stripeSessionId ?? "(none — Stripe was never reached)"}`);
    console.log(`    intent     ${d.stripePaymentIntentId ?? "(none — no webhook has arrived)"}`);
    if (d.status === "SUCCEEDED" || d.status === "REFUNDED") {
      console.log(`    credited   net ${money(d.netCents)}  stripe fee ${money(d.stripeFeeCents)}  available ${d.availableAt?.toISOString().slice(0, 10) ?? "?"}`);
      if (d.stripeFeeCents === 0) console.log("    NOTE: fee read as 0 — the balance transaction could not be expanded");
    } else {
      console.log(`    NOT CREDITED — status is ${d.status}, so it is hidden from history and from the balance`);
    }
  }

  /* ── 4. dead attempts ─────────────────────────────────────────── */
  //
  // A PENDING row with no session id never reached Stripe: checkout
  // was rejected after the row was written. Nothing will ever come to
  // settle it, and it is indistinguishable in every report from a real
  // payment still waiting on a webhook. `createCheckout` now marks
  // these FAILED as they happen; this sweeps up the ones from before
  // it did. It only ever touches rows with no Stripe session, so it
  // cannot mislabel a real payment.
  const dead = await prisma.donation.findMany({
    where: { status: "PENDING", stripeSessionId: null },
    select: { id: true, grossCents: true, createdAt: true },
  });
  if (dead.length > 0) {
    console.log("\n── dead attempts (never reached Stripe) ──────────");
    for (const d of dead) console.log(`  ${d.id}  ${money(d.grossCents)}  ${ago(d.createdAt)}`);
    if (apply) {
      const res = await prisma.donation.updateMany({
        where: { status: "PENDING", stripeSessionId: null },
        data: { status: "FAILED" },
      });
      console.log(`\n  marked ${res.count} FAILED.`);
    } else {
      console.log("\n  Dry run. `npm run donations:sweep` marks these FAILED.");
    }
  }

  /* ── 5. the verdict ───────────────────────────────────────────── */
  const pending = recent.filter((d) => d.status === "PENDING" && d.stripeSessionId);
  console.log("\n── what to do ────────────────────────────────────");
  if (pending.length > 0) {
    console.log(`  ${pending.length} donation(s) reached Stripe but were never credited.`);
    console.log("  That is the webhook, not the payment. Check, in order:");
    console.log("    1. stripe listen --forward-to localhost:3000/api/webhooks/stripe   is running");
    console.log("    2. the whsec_… it prints is saved in /admin/settings/payments");
    console.log("    3. the terminal running `next dev` shows POST /api/webhooks/stripe 200");
    console.log("  Then replay them:  stripe events resend <event-id>   (ids are in `stripe listen`'s output)");
  } else if (recent.length === 0) {
    console.log("  No rows. The checkout POST failed before Stripe was reached — read the 400's body.");
  } else {
    console.log("  Donations are being credited correctly.");
  }
  console.log();
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
