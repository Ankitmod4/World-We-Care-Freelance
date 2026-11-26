/** GET one payout with the member's payment details · PUT to action it. */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMoneyAdmin } from "@/lib/admin-auth";
import { notifyPayout } from "@/lib/payment-notify";
import {
  approvePayout,
  balanceSummaryFor,
  markPaid,
  rejectPayout,
  reversePayout,
  revealPayoutDetails,
} from "@/lib/payouts";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMoneyAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const payout = await prisma.payout.findUnique({ where: { id } });
  if (!payout) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Decrypted only for a payout still waiting to be sent — see
  // revealPayoutDetails. Reading it is written to the audit log,
  // because looking at someone's bank details is an event worth having
  // a record of.
  const details = await revealPayoutDetails(id);
  if (details) {
    await prisma.adminActionLog
      .create({
        data: {
          adminId: auth.id,
          action: "PAYOUT_DETAILS_VIEWED",
          targetUserId: payout.userId,
          meta: { payoutId: id, methodType: details.type },
        },
      })
      .catch(() => undefined);
  }

  return NextResponse.json({
    payout,
    details,
    balance: await balanceSummaryFor(payout.userId),
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMoneyAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof b.action === "string" ? b.action : "";
  const note = typeof b.adminNote === "string" ? b.adminNote : undefined;

  // Loaded before the action so the audit entry can record who and how
  // much even though the row is about to change status.
  const payout = await prisma.payout.findUnique({
    where: { id },
    select: { userId: true, amountCents: true, feeCents: true, netCents: true },
  });
  if (!payout) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let ok = false;
  // What the member is told, once the action has actually landed.
  let outcome: "APPROVED" | "PAID" | "REJECTED" | "REVERSED" | null = null;
  if (action === "approve") {
    ok = await approvePayout(id, auth.id, note);
    outcome = "APPROVED";
  } else if (action === "paid") {
    ok = await markPaid(
      id,
      auth.id,
      typeof b.externalRef === "string" ? b.externalRef : undefined,
      note,
    );
    outcome = "PAID";
  } else if (action === "reverse") {
    // For a transfer that bounced, or a row marked paid by mistake.
    const reason = typeof b.rejectionReason === "string" ? b.rejectionReason : "";
    if (!reason.trim()) {
      return NextResponse.json(
        { error: "Say why it's being reversed — the member sees it." },
        { status: 400 },
      );
    }
    ok = await reversePayout(id, auth.id, reason);
    outcome = "REVERSED";
  } else if (action === "reject") {
    const reason = typeof b.rejectionReason === "string" ? b.rejectionReason : "";
    if (!reason.trim()) {
      return NextResponse.json(
        { error: "Give a reason — the member sees it." },
        { status: 400 },
      );
    }
    ok = await rejectPayout(id, auth.id, reason);
    outcome = "REJECTED";
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  if (!ok) {
    // The status guards in the lib mean "no rows updated" is almost
    // always someone else having actioned it first.
    return NextResponse.json(
      { error: "That payout has already been actioned — reload the page." },
      { status: 409 },
    );
  }

  // After the action, before the response. Best-effort inside.
  if (outcome) await notifyPayout(id, outcome);

  await prisma.adminActionLog
    .create({
      data: {
        adminId: auth.id,
        action:
          action === "approve"
            ? "PAYOUT_APPROVED"
            : action === "paid"
              ? "PAYOUT_PAID"
              : action === "reverse"
                ? "PAYOUT_REVERSED"
                : "PAYOUT_REJECTED",
        targetUserId: payout.userId,
        meta: {
          payoutId: id,
          amountCents: payout.amountCents,
          feeCents: payout.feeCents,
          netCents: payout.netCents,
          externalRef: typeof b.externalRef === "string" ? b.externalRef : null,
        },
        reason:
          action === "reject" && typeof b.rejectionReason === "string"
            ? b.rejectionReason.slice(0, 2000)
            : (note?.slice(0, 2000) ?? null),
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ ok: true });
}
