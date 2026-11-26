/**
 * Taking donations, and turning Stripe's word for it into ledger rows.
 *
 * The money lands in WorldWeCare's own Stripe account and is earmarked
 * for a recipient, who withdraws it later. Nothing here credits a
 * balance until Stripe says the payment succeeded — a PENDING row is a
 * record that a checkout was started, and counts for nothing.
 */

import type Stripe from "stripe";
import { prisma } from "./db";
import { getStripe } from "./stripe";
import { notifyDonationReceived, sendDonationReceipt } from "./payment-notify";
import { getPaymentSettings } from "./payments";

export interface CheckoutInput {
  amountCents: number;
  /** Who the money is for. Null credits WorldWeCare itself. */
  recipientUserId?: string | null;
  campaignId?: string | null;
  /** Donating against an event credits that event's host. */
  eventId?: string | null;
  /**
   * Donating against a live broadcast credits whoever is
   * broadcasting. Only while they are actually ON — see below.
   */
  liveStreamId?: string | null;
  donorUserId?: string | null;
  donorEmail?: string | null;
  message?: string | null;
  isAnonymous?: boolean;
  /** Where Stripe sends the donor afterwards. */
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  donationId: string;
  url: string;
}

/**
 * Create the pending row, then the Stripe session.
 *
 * In that order on purpose: the row carries our id into the session's
 * metadata, so a webhook that arrives before the browser redirects
 * back still knows exactly which donation it belongs to.
 */
/**
 * Did Stripe definitely refuse this request, or do we simply not know?
 *
 * `card_error`, `invalid_request_error`, `authentication_error` and
 * `rate_limit_error` all mean Stripe received the request and declined
 * it — nothing was created. A connection error or an API error means
 * the request may well have succeeded and we lost the answer.
 *
 * The distinction decides whether a donation row may be written off.
 */
function isDefiniteStripeRejection(err: unknown): boolean {
  const type = (err as { type?: string } | null)?.type;
  return (
    type === "StripeCardError" ||
    type === "StripeInvalidRequestError" ||
    type === "StripeAuthenticationError" ||
    type === "StripePermissionError" ||
    type === "StripeRateLimitError" ||
    type === "StripeIdempotencyError"
  );
}

/**
 * A reason the donor is allowed to see.
 *
 * Everything else thrown out of `createCheckout` — a Stripe SDK error,
 * a Prisma error — is internal, and the route must not reflect it to
 * an anonymous caller. Marking the donor-facing ones explicitly is
 * what lets it tell them apart.
 */
export class DonationRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DonationRefused";
  }
}

export async function createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const settings = await getPaymentSettings();
  if (!settings.enabled) throw new DonationRefused("Donations aren't switched on yet.");

  // The amount is re-validated here even though the UI limits it: an
  // amount is the one field where a crafted request costs real money.
  const amount = Math.trunc(input.amountCents);
  if (!Number.isFinite(amount) || amount < settings.minDonationCents) {
    throw new DonationRefused(
      `The smallest donation is ${(settings.minDonationCents / 100).toFixed(2)} ${settings.currency.toUpperCase()}.`,
    );
  }
  if (amount > settings.maxDonationCents) {
    throw new DonationRefused(
      `The largest single donation is ${(settings.maxDonationCents / 100).toFixed(2)} ${settings.currency.toUpperCase()}.`,
    );
  }

  // An event decides its own recipient: the host. Trusting a
  // client-supplied recipientUserId alongside an eventId would let
  // anyone point a donation for someone else's event at their own
  // account.
  let recipientUserId = input.recipientUserId ?? null;
  let causeTitle: string | null = null;
  let campaignId: string | null = null;

  // Same rule as events, for the same reason. An unchecked campaignId
  // went into the ledger verbatim, so anyone could file a donation
  // under any campaign — including a draft one — while crediting
  // themselves. Nothing aggregates by campaign yet; the index exists
  // for when something does, and it should not be attacker-writable
  // by then.
  if (input.campaignId) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: input.campaignId },
      select: { id: true, title: true, status: true },
    });
    if (!campaign || campaign.status !== "PUBLISHED") {
      throw new DonationRefused("That campaign isn't accepting donations.");
    }
    campaignId = campaign.id;
    causeTitle = campaign.title;
  }

  /*
    A LIVE STREAM, LIKE AN EVENT, DECIDES ITS OWN RECIPIENT.

    It would have been less code to hand the client a
    `recipientUserId` and point it at the broadcaster — the recipient
    is validated either way. It is not the recipient that needs
    guarding, it is the CAUSE: a donation filed with a bare recipient
    and no cause is a row that cannot later be told apart from any
    other payment to that person, in the ledger, in their payout
    statement, or in the donor's own history. Resolving it here gets
    the broadcast's title onto the record, and gets it from the
    database rather than from whatever the page chose to send.

    ONLY WHILE THE STREAM IS LIVE. `IDLE` is somebody still setting
    up and `ENDED` is over; in both cases the tip jar is out but
    nobody is there, which is the same reason an event stops taking
    money once it is cancelled or past.
  */
  if (input.liveStreamId) {
    const stream = await prisma.liveStream.findUnique({
      where: { id: input.liveStreamId },
      select: { id: true, title: true, status: true, ownerUserId: true },
    });
    if (!stream || stream.status !== "LIVE") {
      throw new DonationRefused("That broadcast isn't accepting donations.");
    }
    causeTitle = stream.title;
    // No owner means the team is broadcasting — the money is the
    // charity's, exactly as with a team-created event.
    recipientUserId = stream.ownerUserId;
  }

  if (input.eventId) {
    const event = await prisma.event.findUnique({
      where: { id: input.eventId },
      select: { id: true, title: true, status: true, hostUserId: true },
    });
    if (!event || event.status !== "APPROVED") {
      throw new DonationRefused("That event isn't accepting donations.");
    }
    causeTitle = event.title;
    // No host means the team created it — the money is the charity's.
    recipientUserId = event.hostUserId;
  }

  // Confirm the recipient is a real, active account before taking
  // anyone's money on their behalf.
  let recipientName: string | null = null;
  if (recipientUserId) {
    const r = await prisma.user.findUnique({
      where: { id: recipientUserId },
      select: { id: true, displayName: true, isActive: true, bannedAt: true },
    });
    if (!r || !r.isActive || r.bannedAt) {
      throw new DonationRefused("That member can't receive donations right now.");
    }
    recipientName = r.displayName;
  }

  let donorName: string | null = null;
  if (input.donorUserId) {
    const d = await prisma.user.findUnique({
      where: { id: input.donorUserId },
      select: { displayName: true },
    });
    donorName = d?.displayName ?? null;
  }

  const donation = await prisma.donation.create({
    data: {
      grossCents: amount,
      netCents: 0, // set on success, once Stripe's fee is known
      currency: settings.currency,
      donorUserId: input.donorUserId ?? null,
      donorNameSnapshot: donorName,
      donorEmail: input.donorEmail?.trim()?.slice(0, 320) || null,
      isAnonymous: !!input.isAnonymous,
      message: input.message?.trim()?.slice(0, 500) || null,
      recipientUserId,
      recipientNameSnapshot: recipientName,
      campaignId,
      eventId: input.eventId ?? null,
      causeTitleSnapshot: causeTitle,
      status: "PENDING",
    },
    select: { id: true },
  });

  /*
    THE CANCEL URL GETS THE DONATION ID, because Stripe substitutes
    `{CHECKOUT_SESSION_ID}` into `success_url` and nothing at all into
    `cancel_url`. Without it the cancelled page has no way to know
    what was being paid for, and offered everybody "Back to events"
    regardless — including people who had just backed out of a
    campaign.

    The id identifies a row that has taken no money and may never;
    the page reads it only to choose a link, and shows no amount, no
    donor and no recipient.
  */
  const cancelUrl = `${input.cancelUrl}${input.cancelUrl.includes("?") ? "&" : "?"}d=${donation.id}`;

  const stripe = await getStripe();
  // Everything from here to the session id being written back is
  // wrapped: the row already exists, so anything Stripe refuses would
  // otherwise leave it PENDING with no session id, forever. That row
  // is indistinguishable from one legitimately waiting on a webhook,
  // which turns a failed attempt into a phantom "uncredited donation"
  // in every report. A failure is marked FAILED and re-thrown.
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        success_url: input.successUrl,
        cancel_url: cancelUrl,
        customer_email: input.donorEmail || undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: settings.currency,
              unit_amount: amount,
              product_data: {
                // What the donor sees on the Stripe page and on their
                // card statement descriptor — the cause they clicked,
                // not an internal id.
                name: causeTitle
                  ? `Donation — ${causeTitle}`
                  : recipientName
                    ? `Donation to ${recipientName}`
                    : "Donation to WorldWeCare",
              },
            },
          },
        ],
        // Managed Payments is Stripe's merchant-of-record product, and
        // Stripe now switches it on by default for new accounts. It is
        // the wrong shape for this app in two concrete ways:
        //
        //   1. It requires a product tax code on every line item, which
        //      is how this first surfaced ("the product tax code is
        //      missing"). There is no honest tax code for a donation to
        //      a member — it isn't a product being sold.
        //   2. Under MoR, Stripe is the seller and settles differently.
        //      `applyStripeEvent` reads the real processing fee off the
        //      balance transaction on THIS account, and `payouts.ts`
        //      pays members out of that balance. Neither holds if the
        //      funds never land here as an ordinary charge.
        //
        // Set per session rather than left to the dashboard toggle: the
        // account default can be changed by anyone with dashboard
        // access, and differs between test and live. This makes the
        // behaviour a property of the code.
        managed_payments: { enabled: false },
        metadata: { donationId: donation.id },
        // Repeated on the PaymentIntent because refund events carry the
        // intent, not the session, and the handler needs the id there too.
        payment_intent_data: { metadata: { donationId: donation.id } },
      },
      // Stripe-side idempotency: a double-submitted form returns the
      // same session instead of charging twice.
      { idempotencyKey: `donation_${donation.id}` },
    );
  } catch (err) {
    // Only mark FAILED when Stripe DEFINITIVELY refused. A timeout or
    // a dropped connection means we do not know whether the session
    // was created — Stripe may have processed it and the donor may be
    // about to pay. Stamping FAILED there would make the later
    // `checkout.session.completed` land on a row the idempotency guard
    // no longer matches, and a real payment would be silently dropped
    // and logged as a benign replay.
    if (isDefiniteStripeRejection(err)) {
      await prisma.donation
        .updateMany({ where: { id: donation.id, status: "PENDING" }, data: { status: "FAILED", failedAt: new Date() } })
        .catch(() => {});
    }
    throw err;
  }

  await prisma.donation.update({
    where: { id: donation.id },
    data: { stripeSessionId: session.id },
  });

  if (!session.url) {
    // A session with no URL is unusable, so the row must not be left
    // looking like a live attempt either.
    await prisma.donation
      .updateMany({ where: { id: donation.id, status: "PENDING" }, data: { status: "FAILED", failedAt: new Date() } })
      .catch(() => {});
    throw new Error("Stripe didn't return a checkout URL.");
  }
  return { donationId: donation.id, url: session.url };
}

/* ── webhook ─────────────────────────────────────────────────── */

/**
 * Apply one Stripe event.
 *
 * Idempotent by construction: every write is a conditional updateMany
 * that also matches on the status it expects to be leaving. A replayed
 * event therefore updates zero rows instead of crediting twice, which
 * matters because Stripe retries for up to three days and will happily
 * deliver the same event again after a timeout.
 */
export async function applyStripeEvent(event: Stripe.Event): Promise<{ handled: boolean; note: string }> {
  switch (event.type) {
    case "checkout.session.completed":
    // A delayed method (bank debit, some wallets) completes its
    // session UNPAID and settles days later. `handleCompleted`
    // refuses to credit an unpaid session, so without this case the
    // donor is charged, the money arrives, and the row stays PENDING
    // for ever — invisible to the donor and to the balance.
    case "checkout.session.async_payment_succeeded":
      return handleCompleted(event.data.object as Stripe.Checkout.Session);

    case "checkout.session.async_payment_failed":
      return handleAsyncFailed(event.data.object as Stripe.Checkout.Session);

    case "charge.refunded":
      return handleRefund(event.data.object as Stripe.Charge);

    // A refund can fail after the fact (a closed bank account). Stripe
    // reports `amount_refunded` net of failed refunds, so re-reading
    // the charge and running the same set-not-increment logic puts the
    // credit back without any special case.
    case "charge.refund.updated":
      return handleRefundUpdated(event.data.object as Stripe.Refund);

    // Chargebacks. The money leaves the platform account the moment a
    // dispute opens, so the credit has to leave the member's balance
    // at the same moment.
    case "charge.dispute.created":
      return handleDisputeOpened(event.data.object as Stripe.Dispute);
    case "charge.dispute.closed":
      return handleDisputeClosed(event.data.object as Stripe.Dispute);

    case "checkout.session.expired":
      return handleExpired(event.data.object as Stripe.Checkout.Session);

    default:
      return { handled: false, note: `Ignored ${event.type}` };
  }
}

async function handleCompleted(s: Stripe.Checkout.Session) {
  const donationId = s.metadata?.donationId ?? null;
  // Unpaid sessions can complete (bank debits settle later). Only paid
  // ones credit anything.
  if (s.payment_status !== "paid") {
    return { handled: false, note: `Session ${s.id} completed but not paid` };
  }

  const settings = await getPaymentSettings();
  const intentId =
    typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;

  // Ask Stripe what it actually kept, rather than recomputing a rate
  // that is wrong for Amex, international cards and negotiated pricing.
  let stripeFeeCents = 0;
  let chargeId: string | null = null;
  let feeUnknown = false;
  if (intentId) {
    try {
      const stripe = await getStripe();
      const intent = await stripe.paymentIntents.retrieve(intentId, {
        expand: ["latest_charge.balance_transaction"],
      });
      const charge = intent.latest_charge as Stripe.Charge | null;
      chargeId = charge?.id ?? null;
      const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null;
      if (bt && typeof bt.fee === "number") stripeFeeCents = bt.fee;
    } catch {
      // A fee we couldn't read is recorded as 0 rather than guessed —
      // the donation is real and must be credited either way. But in
      // "net" mode that hands the recipient the full gross while
      // Stripe has still taken its cut, so the platform absorbs the
      // difference. Flag it: a silent loss is the thing to avoid.
      stripeFeeCents = 0;
      feeUnknown = true;
    }
  }

  const gross = s.amount_total ?? 0;
  const platformFeeCents = 0; // taken at payout, not here
  const netCents = Math.max(
    0,
    (settings.creditRecipient === "net" ? gross - stripeFeeCents : gross) - platformFeeCents,
  );
  const now = new Date();
  const availableAt = new Date(now.getTime() + settings.payoutHoldDays * 86_400_000);

  const data = {
    status: "SUCCEEDED" as const,
    stripePaymentIntentId: intentId,
    stripeChargeId: chargeId,
    stripeFeeCents,
    feeUnknown,
    platformFeeCents,
    netCents,
    succeededAt: now,
    availableAt,
    donorEmail: s.customer_details?.email ?? undefined,
  };

  if (donationId) {
    // The status guard is the idempotency: a replay finds nothing PENDING.
    // FAILED is included deliberately. It is OUR conclusion, reached
    // when a create call errored; `checkout.session.completed` is
    // Stripe's, and Stripe is the authority on whether it was paid. A
    // row we wrote off after a timeout is rescued here rather than
    // becoming a real payment nobody was credited for. A genuine
    // replay still finds SUCCEEDED and updates nothing.
    const res = await prisma.donation.updateMany({
      where: { id: donationId, status: { in: ["PENDING", "FAILED"] } },
      data,
    });
    if (res.count === 0) {
      return { handled: true, note: `Donation ${donationId} already settled — replay ignored` };
    }
    // Only on the transition, never on a replay: the status guard above
    // is what stops Stripe's retries sending the receipt three times.
    // Both are best-effort and swallow their own errors — a failed
    // email must not make this handler throw, or Stripe would retry an
    // event that has already been applied.
    await sendDonationReceipt(donationId);
    await notifyDonationReceived(donationId);
    return { handled: true, note: `Donation ${donationId} credited ${netCents}` };
  }

  // No metadata — a payment made outside this flow. Record it against
  // nobody rather than dropping it, so the money is at least visible.
  const existing = await prisma.donation.findFirst({
    where: { stripeSessionId: s.id },
    select: { id: true },
  });
  if (existing) return { handled: true, note: `Session ${s.id} already recorded` };
  await prisma.donation.create({
    data: {
      ...data,
      stripeSessionId: s.id,
      grossCents: gross,
      currency: s.currency ?? settings.currency,
      donorEmail: s.customer_details?.email ?? null,
    },
  });
  return { handled: true, note: `Recorded unattributed session ${s.id}` };
}

async function handleRefund(charge: Stripe.Charge) {
  const refunded = charge.amount_refunded ?? 0;
  const intentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;
  if (!intentId) return { handled: false, note: "Refund with no payment intent" };

  const donation = await prisma.donation.findFirst({
    where: { stripePaymentIntentId: intentId },
    select: { id: true, grossCents: true, netCents: true, refundedCents: true, status: true },
  });
  if (!donation) return { handled: false, note: `No donation for intent ${intentId}` };
  // A refund arriving on a disputed donation must not pull it back to
  // REFUNDED: that status counts toward the balance, and the dispute
  // means the platform does not hold the money.
  if (donation.status === "DISPUTED") {
    return { handled: true, note: `Donation ${donation.id} is disputed — refund not applied` };
  }
  if (donation.refundedCents === refunded) {
    return { handled: true, note: "Refund already recorded" };
  }

  // Refunds are reported as a running total, so this is a set, not an
  // increment — a second partial refund would otherwise double-count.
  //
  // The clawback is proportional: refunding half a donation should take
  // back half of what was credited, not half of what the donor paid,
  // because Stripe's fee was never credited in the first place.
  const share = donation.grossCents > 0 ? refunded / donation.grossCents : 0;
  const clawback = Math.min(donation.netCents, Math.round(donation.netCents * share));

  await prisma.donation.update({
    where: { id: donation.id },
    data: {
      status: "REFUNDED",
      refundedCents: clawback,
      refundedAt: new Date(),
    },
  });
  return { handled: true, note: `Donation ${donation.id} refunded ${clawback}` };
}

/** A delayed payment that never settled. Frees the row rather than
 *  leaving it PENDING for ever. */
async function handleAsyncFailed(s: Stripe.Checkout.Session) {
  const res = await prisma.donation.updateMany({
    where: { stripeSessionId: s.id, status: "PENDING" },
    data: { status: "FAILED", failedAt: new Date() },
  });
  return { handled: res.count > 0, note: `Async payment failed for session ${s.id}` };
}

/**
 * Find the donation a dispute or refund belongs to.
 *
 * Dispute events name a CHARGE; checkout events gave us a payment
 * intent. Both ids are stored, so try each — a donation recorded
 * before `stripeChargeId` was populated is still findable by intent.
 */
async function donationForCharge(
  chargeId: string | null,
  intentId: string | null,
): Promise<{ id: string; grossCents: number; netCents: number; refundedCents: number; status: string } | null> {
  const select = { id: true, grossCents: true, netCents: true, refundedCents: true, status: true };
  if (chargeId) {
    const byCharge = await prisma.donation.findFirst({ where: { stripeChargeId: chargeId }, select });
    if (byCharge) return byCharge;
  }
  if (intentId) {
    return prisma.donation.findFirst({ where: { stripePaymentIntentId: intentId }, select });
  }
  return null;
}

const idOf = (v: string | { id: string } | null | undefined): string | null =>
  typeof v === "string" ? v : v?.id ?? null;

/**
 * A chargeback has been opened.
 *
 * Stripe has already taken the money back out of the platform's
 * balance. Moving the donation to DISPUTED takes it out of
 * `balanceFor`'s two aggregates in the same instant, so a member
 * cannot request a withdrawal against money the platform no longer
 * holds. Nothing else about their account changes.
 *
 * Only SUCCEEDED and REFUNDED rows move: a PENDING row was never
 * credited, and one already DISPUTED must not be re-stamped, so a
 * replayed event is a no-op.
 */
async function handleDisputeOpened(d: Stripe.Dispute) {
  const donation = await donationForCharge(idOf(d.charge), idOf(d.payment_intent));
  if (!donation) return { handled: false, note: `No donation for dispute ${d.id}` };

  const res = await prisma.donation.updateMany({
    where: { id: donation.id, status: { in: ["SUCCEEDED", "REFUNDED"] } },
    data: { status: "DISPUTED", disputedAt: new Date() },
  });
  if (res.count === 0) {
    return { handled: true, note: `Donation ${donation.id} already ${donation.status} — dispute ignored` };
  }
  return { handled: true, note: `Donation ${donation.id} DISPUTED, ${donation.netCents} credit reversed` };
}

/**
 * A chargeback has been resolved.
 *
 * Won means the money came back, so the credit is restored. Anything
 * else — lost, or a warning that closed without becoming a dispute we
 * won — leaves the row DISPUTED, which is the honest reading: the
 * platform does not have that money.
 */
async function handleDisputeClosed(d: Stripe.Dispute) {
  const donation = await donationForCharge(idOf(d.charge), idOf(d.payment_intent));
  if (!donation) return { handled: false, note: `No donation for dispute ${d.id}` };

  if (d.status !== "won") {
    return { handled: true, note: `Dispute ${d.id} closed as ${d.status} — donation ${donation.id} stays reversed` };
  }
  const res = await prisma.donation.updateMany({
    where: { id: donation.id, status: "DISPUTED" },
    data: { status: donation.refundedCents > 0 ? "REFUNDED" : "SUCCEEDED" },
  });
  return {
    handled: true,
    note: res.count > 0
      ? `Dispute ${d.id} won — donation ${donation.id} credit restored`
      : `Dispute ${d.id} won but donation ${donation.id} was not disputed`,
  };
}

/**
 * A refund changed state after it was created — most importantly, it
 * failed. Re-read the charge and re-apply: `amount_refunded` is net of
 * failed refunds, and `handleRefund` sets rather than increments, so
 * the same code puts the credit back.
 */
async function handleRefundUpdated(refund: Stripe.Refund) {
  const chargeId = idOf(refund.charge);
  if (!chargeId) return { handled: false, note: `Refund ${refund.id} has no charge` };
  const stripe = await getStripe();
  const charge = await stripe.charges.retrieve(chargeId);
  return handleRefund(charge);
}

async function handleExpired(s: Stripe.Checkout.Session) {
  const res = await prisma.donation.updateMany({
    where: { stripeSessionId: s.id, status: "PENDING" },
    data: { status: "FAILED", failedAt: new Date() },
  });
  return { handled: res.count > 0, note: `Expired session ${s.id}` };
}

/* ── reading ─────────────────────────────────────────────────── */

export interface DonationRow {
  id: string;
  grossCents: number;
  netCents: number;
  refundedCents: number;
  currency: string;
  status: string;
  message: string | null;
  isAnonymous: boolean;
  recipientName: string | null;
  donorName: string | null;
  causeTitle: string | null;
  createdAt: string;
  succeededAt: string | null;
  availableAt: string | null;
}

/**
 * `shape` is the ONLY thing that turns a Donation row into something
 * that leaves the server, and it takes an audience for a reason.
 *
 * "Give without showing my name" used to be honoured by the JSX
 * alone: the donor's real name was serialised into the recipient's
 * page payload and simply not rendered. Anyone who opened devtools —
 * or read the JSON from `/api/user/donations` — saw it. Anonymity
 * that a Network tab undoes is not anonymity.
 *
 * The donor's OWN history is the exception: they may see their own
 * name on their own giving, anonymous or not.
 */
type Audience = "donor" | "recipient";

const shape = (audience: Audience) => (d: {
  id: string; grossCents: number; netCents: number; refundedCents: number;
  currency: string; status: string; message: string | null; isAnonymous: boolean;
  recipientNameSnapshot: string | null; donorNameSnapshot: string | null;
  causeTitleSnapshot: string | null;
  createdAt: Date; succeededAt: Date | null; availableAt: Date | null;
}): DonationRow => ({
  id: d.id,
  grossCents: d.grossCents,
  netCents: d.netCents,
  refundedCents: d.refundedCents,
  currency: d.currency,
  status: d.status,
  message: d.message,
  isAnonymous: d.isAnonymous,
  recipientName: d.recipientNameSnapshot,
  // Redacted here, not in the component. See the note above `shape`.
  donorName: audience === "recipient" && d.isAnonymous ? null : d.donorNameSnapshot,
  causeTitle: d.causeTitleSnapshot,
  createdAt: d.createdAt.toISOString(),
  succeededAt: d.succeededAt?.toISOString() ?? null,
  availableAt: d.availableAt?.toISOString() ?? null,
});

const ROW_SELECT = {
  id: true, grossCents: true, netCents: true, refundedCents: true, currency: true,
  status: true, message: true, isAnonymous: true, recipientNameSnapshot: true,
  donorNameSnapshot: true, causeTitleSnapshot: true, createdAt: true,
  succeededAt: true, availableAt: true,
} as const;

/** What the donor gave. PENDING rows are hidden — an abandoned checkout
 *  in someone's giving history is confusing and means nothing. */
export async function listGiven(userId: string, take = 50): Promise<DonationRow[]> {
  const rows = await prisma.donation.findMany({
    // DISPUTED is listed but never counted — `balanceFor` is what
    // decides what can be withdrawn, and it excludes it. Hiding the
    // row instead would make money silently disappear from a member's
    // history with no explanation.
    where: { donorUserId: userId, status: { in: ["SUCCEEDED", "REFUNDED", "DISPUTED"] } },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, take),
    select: ROW_SELECT,
  });
  return rows.map(shape("donor"));
}

/** What the member received. */
export async function listReceived(userId: string, take = 50): Promise<DonationRow[]> {
  const rows = await prisma.donation.findMany({
    where: { recipientUserId: userId, status: { in: ["SUCCEEDED", "REFUNDED", "DISPUTED"] } },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, take),
    select: ROW_SELECT,
  });
  return rows.map(shape("recipient"));
}


/* ── admin ────────────────────────────────────────────────────────
 *
 * Money going out had a queue; money coming in had nothing at all —
 * no list, no totals, no way to see a donation, and so no way to
 * notice that a webhook outage had stranded every payment in PENDING.
 * The `@@index([status, createdAt])` on Donation was added for this
 * and had no query behind it.
 */

export interface AdminDonationRow {
  id: string;
  status: string;
  grossCents: number;
  netCents: number;
  stripeFeeCents: number;
  refundedCents: number;
  feeUnknown: boolean;
  currency: string;
  message: string | null;
  isAnonymous: boolean;
  donorName: string | null;
  donorEmail: string | null;
  donorUserId: string | null;
  recipientName: string | null;
  recipientUserId: string | null;
  causeTitle: string | null;
  eventId: string | null;
  campaignId: string | null;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  createdAt: string;
  succeededAt: string | null;
  availableAt: string | null;
  disputedAt: string | null;
}

export async function listAllDonations(
  opts: { status?: string; q?: string; take?: number } = {},
): Promise<AdminDonationRow[]> {
  const where: Record<string, unknown> = {};
  if (opts.status && opts.status !== "ALL") where.status = opts.status;

  const q = opts.q?.trim();
  if (q) {
    where.OR = [
      { donorNameSnapshot: { contains: q } },
      { donorEmail: { contains: q } },
      { recipientNameSnapshot: { contains: q } },
      { causeTitleSnapshot: { contains: q } },
      // Paste a Stripe id straight from the dashboard and find the row.
      { stripeSessionId: { contains: q } },
      { stripePaymentIntentId: { contains: q } },
    ];
  }

  const rows = await prisma.donation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(200, opts.take ?? 50),
    select: {
      id: true, status: true, grossCents: true, netCents: true, stripeFeeCents: true,
      refundedCents: true, feeUnknown: true, currency: true, message: true,
      isAnonymous: true, donorNameSnapshot: true, donorEmail: true, donorUserId: true,
      recipientNameSnapshot: true, recipientUserId: true, causeTitleSnapshot: true,
      eventId: true, campaignId: true, stripeSessionId: true, stripePaymentIntentId: true,
      createdAt: true, succeededAt: true, availableAt: true, disputedAt: true,
    },
  });

  return rows.map((d) => ({
    id: d.id,
    status: d.status,
    grossCents: d.grossCents,
    netCents: d.netCents,
    stripeFeeCents: d.stripeFeeCents,
    refundedCents: d.refundedCents,
    feeUnknown: d.feeUnknown,
    currency: d.currency,
    message: d.message,
    isAnonymous: d.isAnonymous,
    // The admin DOES see the name behind an anonymous gift — they have
    // to be able to answer a refund request or a complaint — but the
    // row is flagged so it is never repeated back to the recipient.
    donorName: d.donorNameSnapshot,
    donorEmail: d.donorEmail,
    donorUserId: d.donorUserId,
    recipientName: d.recipientNameSnapshot,
    recipientUserId: d.recipientUserId,
    causeTitle: d.causeTitleSnapshot,
    eventId: d.eventId,
    campaignId: d.campaignId,
    stripeSessionId: d.stripeSessionId,
    stripePaymentIntentId: d.stripePaymentIntentId,
    createdAt: d.createdAt.toISOString(),
    succeededAt: d.succeededAt?.toISOString() ?? null,
    availableAt: d.availableAt?.toISOString() ?? null,
    disputedAt: d.disputedAt?.toISOString() ?? null,
  }));
}

export interface DonationTotals {
  byStatus: Record<string, { count: number; grossCents: number; netCents: number }>;
  /** Money actually taken, net of refunds and chargebacks. */
  collectedCents: number;
  /** What Stripe kept, across everything that succeeded. */
  stripeFeesCents: number;
  /** Rows credited without a readable fee — a silent cost if ignored. */
  feeUnknownCount: number;
  /** Started and never resolved. A rising number means the webhook is down. */
  strandedCount: number;
}

export async function donationTotals(): Promise<DonationTotals> {
  const [rows, feeUnknownCount, strandedCount] = await Promise.all([
    prisma.donation.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { grossCents: true, netCents: true, refundedCents: true, stripeFeeCents: true },
    }),
    prisma.donation.count({ where: { feeUnknown: true } }),
    // PENDING with a session means Stripe was reached and nothing came
    // back — the shape a missing webhook makes.
    prisma.donation.count({
      where: { status: "PENDING", stripeSessionId: { not: null } },
    }),
  ]);

  const byStatus: DonationTotals["byStatus"] = {};
  let collectedCents = 0;
  let stripeFeesCents = 0;
  for (const r of rows) {
    byStatus[r.status] = {
      count: r._count._all,
      grossCents: r._sum.grossCents ?? 0,
      netCents: r._sum.netCents ?? 0,
    };
    // DISPUTED and FAILED money is not money the platform has.
    if (r.status === "SUCCEEDED" || r.status === "REFUNDED") {
      collectedCents += (r._sum.grossCents ?? 0) - (r._sum.refundedCents ?? 0);
      stripeFeesCents += r._sum.stripeFeeCents ?? 0;
    }
  }
  return { byStatus, collectedCents, stripeFeesCents, feeUnknownCount, strandedCount };
}
