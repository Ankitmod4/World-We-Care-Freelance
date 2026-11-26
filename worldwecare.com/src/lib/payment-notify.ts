/**
 * Telling people what happened to their money.
 *
 * Three screens promised this and nothing sent anything: the thanks
 * page said "a receipt will follow by email", the withdrawal form said
 * "you'll hear when it's been sent", and the admin reject flow said
 * "the member sees it" — which was only true if the member happened
 * to revisit the page.
 *
 * EVERY function here is best-effort and swallows its own errors.
 * A notification that fails must never roll back a payment or leave a
 * webhook returning 500, because Stripe would then retry an event that
 * was already applied. The money is the thing that has to be right;
 * the email is the thing that can be sent again.
 */

import { prisma } from "./db";
import { createUserNotification } from "./notifications";
import { sendEmail } from "./email";
import { getSetting } from "./settings";
import { formatCents } from "./money";

const appUrl = () => getSetting<string>("general.appUrl", "");

async function siteName() {
  return getSetting<string>("general.siteName", "WorldWeCare");
}

/** The donor's receipt. Sent to whoever paid, member or not. */
export async function sendDonationReceipt(donationId: string): Promise<void> {
  try {
    const d = await prisma.donation.findUnique({
      where: { id: donationId },
      select: {
        grossCents: true, currency: true, donorEmail: true, donorNameSnapshot: true,
        causeTitleSnapshot: true, recipientNameSnapshot: true, succeededAt: true,
      },
    });
    if (!d?.donorEmail) return;

    const [name, base] = await Promise.all([siteName(), appUrl()]);
    await sendEmail({
      templateSlug: "donation_receipt",
      to: d.donorEmail,
      variables: {
        name: d.donorNameSnapshot ?? "there",
        siteName: name,
        appUrl: base,
        amount: formatCents(d.grossCents, d.currency),
        cause: d.causeTitleSnapshot ?? d.recipientNameSnapshot ?? name,
        date: (d.succeededAt ?? new Date()).toLocaleDateString("en-US", {
          year: "numeric", month: "long", day: "numeric",
        }),
      },
    });
  } catch (err) {
    console.warn("[payments] receipt failed:", err);
  }
}

/** Tell a member that money arrived for them. */
export async function notifyDonationReceived(donationId: string): Promise<void> {
  try {
    const d = await prisma.donation.findUnique({
      where: { id: donationId },
      select: {
        recipientUserId: true, netCents: true, currency: true, isAnonymous: true,
        donorNameSnapshot: true, causeTitleSnapshot: true, availableAt: true,
      },
    });
    if (!d?.recipientUserId) return;

    // The anonymity promise holds here too — this text is written for
    // the recipient, so it must not carry the donor's name.
    const from = d.isAnonymous ? "Someone" : d.donorNameSnapshot ?? "Someone";
    const clears = d.availableAt && d.availableAt > new Date()
      ? ` It can be withdrawn from ${d.availableAt.toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`
      : "";

    await createUserNotification({
      userId: d.recipientUserId,
      type: "DONATION_RECEIVED",
      title: `${from} donated ${formatCents(d.netCents, d.currency)}`,
      body: (d.causeTitleSnapshot ? `Towards ${d.causeTitleSnapshot}.` : "") + clears,
      actionUrl: "/settings/donations",
    });
  } catch (err) {
    console.warn("[payments] donation notification failed:", err);
  }
}

type PayoutOutcome = "APPROVED" | "PAID" | "REJECTED" | "REVERSED";

/** Tell a member what happened to their withdrawal request. */
export async function notifyPayout(payoutId: string, outcome: PayoutOutcome): Promise<void> {
  try {
    const p = await prisma.payout.findUnique({
      where: { id: payoutId },
      select: { userId: true, netCents: true, currency: true, rejectionReason: true },
    });
    if (!p?.userId) return;

    const amount = formatCents(p.netCents, p.currency);
    const copy: Record<PayoutOutcome, { type: "PAYOUT_APPROVED" | "PAYOUT_PAID" | "PAYOUT_REJECTED"; title: string; body: string }> = {
      APPROVED: {
        type: "PAYOUT_APPROVED",
        title: `Your ${amount} withdrawal was approved`,
        body: "It's being sent now. We'll let you know when it's on its way.",
      },
      PAID: {
        type: "PAYOUT_PAID",
        title: `${amount} is on its way`,
        body: "Depending on your bank or PayPal, it can take a few working days to land.",
      },
      REJECTED: {
        type: "PAYOUT_REJECTED",
        title: `Your ${amount} withdrawal wasn't sent`,
        body: p.rejectionReason ?? "Open your payouts page for details.",
      },
      // A reversal IS a rejection as far as the ledger is concerned,
      // but saying "wasn't sent" to someone who was already told it was
      // sent would be baffling. The money is back on their balance.
      REVERSED: {
        type: "PAYOUT_REJECTED",
        title: `Your ${amount} withdrawal came back`,
        body: (p.rejectionReason ?? "The transfer didn't complete.") +
          " The amount is back on your balance and you can request it again.",
      },
    };

    const c = copy[outcome];
    await createUserNotification({
      userId: p.userId,
      type: c.type,
      title: c.title,
      body: c.body,
      actionUrl: "/settings/payouts",
    });
  } catch (err) {
    console.warn("[payments] payout notification failed:", err);
  }
}
