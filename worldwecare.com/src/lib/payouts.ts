/**
 * Payout methods and withdrawal requests.
 *
 * Payouts are sent by hand: an admin reads the member's details, moves
 * the money, and marks the request paid. Everything here exists to make
 * that safe — the member can't withdraw money they don't have, can't
 * withdraw the same money twice, and their bank details are readable
 * only at the moment an admin is actually sending something.
 */

import { prisma } from "./db";
import { open, seal } from "./secret-box";
import { balanceFor, getPaymentSettings, splitFee } from "./payments";
export { balanceFor as balanceSummaryFor };

export type MethodType = "PAYPAL" | "BANK" | "WISE" | "CHECK";
export const METHOD_TYPES: MethodType[] = ["PAYPAL", "BANK", "WISE", "CHECK"];

export const METHOD_LABEL: Record<MethodType, string> = {
  PAYPAL: "PayPal",
  BANK: "Bank transfer",
  WISE: "Wise",
  CHECK: "Posted cheque",
};

/** Safe view of a stored method. Never carries the sealed details. */
export interface MethodRow {
  id: string;
  type: MethodType;
  typeLabel: string;
  label: string | null;
  displayHint: string;
  isDefault: boolean;
  /** False when the stored blob can't be read under the current key. */
  readable: boolean;
  createdAt: string;
}

/* ── shaping and masking ─────────────────────────────────────── */

const str = (v: unknown, max = 200): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** a…@gmail.com — enough to recognise, not enough to reuse. */
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "…";
  return `${user.slice(0, 1)}…@${domain}`;
}

/** Last four only. Never render more of an account number than this. */
function maskTail(value: string, keep = 4): string {
  const clean = value.replace(/\s+/g, "");
  return clean.length <= keep ? "…" : `····${clean.slice(-keep)}`;
}

/**
 * Validate what the member typed and produce (sealed details, hint).
 *
 * Returns an error string rather than throwing so the API can hand it
 * straight back to the form.
 */
export function buildMethod(
  type: MethodType,
  raw: Record<string, unknown>,
): { ok: true; details: string; displayHint: string } | { ok: false; error: string } {
  if (type === "PAYPAL" || type === "WISE") {
    const email = str(raw.email, 320).toLowerCase();
    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
      return { ok: false, error: `Enter the email address on your ${METHOD_LABEL[type]} account.` };
    }
    return {
      ok: true,
      details: seal(JSON.stringify({ email })),
      displayHint: `${METHOD_LABEL[type]} · ${maskEmail(email)}`,
    };
  }

  if (type === "BANK") {
    const accountName = str(raw.accountName, 120);
    const accountNumber = str(raw.accountNumber, 64);
    const routingNumber = str(raw.routingNumber, 64);
    const iban = str(raw.iban, 64).toUpperCase();
    const swift = str(raw.swift, 32).toUpperCase();
    const bankName = str(raw.bankName, 120);
    const country = str(raw.country, 2).toUpperCase();

    if (!accountName) return { ok: false, error: "Enter the name on the account." };
    // Either domestic (number + routing) or international (IBAN). Asking
    // for both would make the form impossible to complete correctly in
    // most of the world.
    if (!accountNumber && !iban) {
      return { ok: false, error: "Enter either an account number or an IBAN." };
    }
    if (accountNumber && !routingNumber && !swift) {
      return {
        ok: false,
        error: "An account number needs a routing number or a SWIFT/BIC code alongside it.",
      };
    }
    return {
      ok: true,
      details: seal(
        JSON.stringify({ accountName, accountNumber, routingNumber, iban, swift, bankName, country }),
      ),
      displayHint: `Bank · ${maskTail(iban || accountNumber)}${bankName ? ` · ${bankName}` : ""}`,
    };
  }

  // CHECK
  const payeeName = str(raw.payeeName, 120);
  const line1 = str(raw.line1, 160);
  const city = str(raw.city, 80);
  const postcode = str(raw.postcode, 24);
  const country = str(raw.country, 2).toUpperCase();
  if (!payeeName || !line1 || !city || !postcode) {
    return { ok: false, error: "A posted cheque needs a payee name and a full address." };
  }
  return {
    ok: true,
    details: seal(
      JSON.stringify({
        payeeName, line1, line2: str(raw.line2, 160), city,
        state: str(raw.state, 80), postcode, country,
      }),
    ),
    displayHint: `Cheque · ${payeeName}, ${city}`,
  };
}

/* ── member: methods ─────────────────────────────────────────── */

export async function listMethods(userId: string): Promise<MethodRow[]> {
  const rows = await prisma.payoutMethod.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((m) => ({
    id: m.id,
    type: m.type as MethodType,
    typeLabel: METHOD_LABEL[m.type as MethodType] ?? m.type,
    label: m.label,
    displayHint: m.displayHint,
    isDefault: m.isDefault,
    // Surfaced rather than hidden: after a key rotation the member has
    // to re-enter it, and silently showing a method that can't be paid
    // to would strand a request in the admin queue.
    readable: open(m.details) !== null,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function addMethod(
  userId: string,
  type: MethodType,
  raw: Record<string, unknown>,
  label?: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const settings = await getPaymentSettings();
  if (!settings.payoutMethods.includes(type)) {
    return { ok: false, error: `${METHOD_LABEL[type]} isn't accepted at the moment.` };
  }
  const built = buildMethod(type, raw);
  if (!built.ok) return built;

  const count = await prisma.payoutMethod.count({ where: { userId } });
  if (count >= 5) {
    return { ok: false, error: "You can save up to five payout methods. Remove one first." };
  }

  const created = await prisma.payoutMethod.create({
    data: {
      userId,
      type,
      label: label?.trim()?.slice(0, 80) || null,
      details: built.details,
      displayHint: built.displayHint,
      // First one added becomes the default, so there is always one.
      isDefault: count === 0,
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

export async function setDefaultMethod(userId: string, id: string): Promise<boolean> {
  const owned = await prisma.payoutMethod.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!owned) return false;
  await prisma.$transaction([
    prisma.payoutMethod.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.payoutMethod.update({ where: { id }, data: { isDefault: true } }),
  ]);
  return true;
}

/**
 * Remove a method.
 *
 * Refused while a request that names it is still open — the admin is
 * about to read those details to send money, and deleting them
 * mid-flight leaves a payout nobody can complete. Paid history is
 * unaffected: Payout.methodSnapshot holds a frozen copy.
 */
export async function removeMethod(
  userId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const method = await prisma.payoutMethod.findFirst({
    where: { id, userId },
    select: { id: true, isDefault: true },
  });
  if (!method) return { ok: false, error: "Not found." };

  const open_ = await prisma.payout.count({
    where: { methodId: id, status: { in: ["REQUESTED", "APPROVED"] } },
  });
  if (open_ > 0) {
    return {
      ok: false,
      error: "There's a payout waiting to be sent to this method. Cancel it first.",
    };
  }

  await prisma.payoutMethod.delete({ where: { id } });
  if (method.isDefault) {
    const next = await prisma.payoutMethod.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (next) await prisma.payoutMethod.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  return { ok: true };
}

/* ── member: requesting ──────────────────────────────────────── */

export async function requestPayout(
  userId: string,
  amountCents: number,
  methodId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const settings = await getPaymentSettings();
  if (!settings.enabled) return { ok: false, error: "Payouts aren't switched on at the moment." };

  const amount = Math.trunc(amountCents);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter an amount." };
  }
  if (amount < settings.payoutMinCents) {
    return {
      ok: false,
      error: `The smallest withdrawal is ${(settings.payoutMinCents / 100).toFixed(2)} ${settings.currency.toUpperCase()}.`,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, email: true, isActive: true, bannedAt: true },
  });
  if (!user || !user.isActive || user.bannedAt) {
    return { ok: false, error: "Your account can't request a payout." };
  }

  const method = await prisma.payoutMethod.findFirst({
    where: { id: methodId, userId },
  });
  if (!method) return { ok: false, error: "Choose a payout method." };
  if (open(method.details) === null) {
    return {
      ok: false,
      error: "That payout method can't be read any more — remove it and add it again.",
    };
  }

  const { feeCents, netCents } = splitFee(amount, settings.payoutFeeBasisPoints);
  if (netCents <= 0) {
    return { ok: false, error: "That amount is entirely consumed by the fee." };
  }

  try {
    const id = await prisma.$transaction(async (tx) => {
      // Serialise every payout request for this member against one
      // another. Without the lock, two requests submitted at the same
      // moment each read the same balance, each find it sufficient, and
      // both commit — the classic double-withdrawal. REPEATABLE READ
      // does not prevent that on its own because neither transaction
      // sees the other's insert.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;

      // On `tx`, not the global client — see the note on balanceFor.
      const balance = await balanceFor(userId, tx);
      if (amount > balance.availableCents) {
        throw new Error(
          `You can withdraw up to ${(balance.availableCents / 100).toFixed(2)} ${settings.currency.toUpperCase()} right now.`,
        );
      }

      const row = await tx.payout.create({
        data: {
          userId,
          userNameSnapshot: user.displayName,
          userEmailSnapshot: user.email,
          amountCents: amount,
          feeBasisPoints: settings.payoutFeeBasisPoints,
          feeCents,
          netCents,
          currency: settings.currency,
          methodId: method.id,
          methodSnapshot: {
            type: method.type,
            label: method.label,
            displayHint: method.displayHint,
          },
          status: "REQUESTED",
        },
        select: { id: true },
      });
      return row.id;
    });
    return { ok: true, id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't create that request.",
    };
  }
}

/** A member withdrawing their own request while it's still untouched. */
export async function cancelPayout(userId: string, id: string): Promise<boolean> {
  const res = await prisma.payout.updateMany({
    where: { id, userId, status: "REQUESTED" },
    data: { status: "CANCELLED" },
  });
  return res.count > 0;
}

export async function listPayouts(userId: string, take = 50) {
  return prisma.payout.findMany({
    where: { userId },
    orderBy: { requestedAt: "desc" },
    take: Math.min(200, take),
  });
}

/* ── admin ───────────────────────────────────────────────────── */

export async function listAllPayouts(opts: { status?: string; q?: string; take?: number } = {}) {
  const where: Record<string, unknown> = {};
  if (opts.status && opts.status !== "ALL") where.status = opts.status;
  if (opts.q?.trim()) {
    where.OR = [
      { userNameSnapshot: { contains: opts.q.trim() } },
      { userEmailSnapshot: { contains: opts.q.trim() } },
      { externalRef: { contains: opts.q.trim() } },
    ];
  }
  return prisma.payout.findMany({
    where,
    // Oldest request first: the queue exists to be drained, and the
    // person who has waited longest should be looked at first.
    orderBy: [{ status: "asc" }, { requestedAt: "asc" }],
    take: Math.min(200, opts.take ?? 50),
  });
}

/**
 * The member's actual payment details, decrypted.
 *
 * Called only from the admin payout detail route, and only for a
 * payout that is still open. Once a payout is PAID or REJECTED there
 * is no reason to read someone's bank details again, so the answer is
 * null and the snapshot's display hint is all that remains.
 */
export async function revealPayoutDetails(
  payoutId: string,
): Promise<{ type: string; details: Record<string, unknown> } | null> {
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    select: { status: true, method: { select: { type: true, details: true } } },
  });
  if (!payout?.method) return null;
  if (payout.status !== "REQUESTED" && payout.status !== "APPROVED") return null;
  const plain = open(payout.method.details);
  if (!plain) return null;
  try {
    return { type: payout.method.type, details: JSON.parse(plain) as Record<string, unknown> };
  } catch {
    return null;
  }
}

export async function approvePayout(id: string, adminId: string, note?: string) {
  const res = await prisma.payout.updateMany({
    where: { id, status: "REQUESTED" },
    data: {
      status: "APPROVED",
      reviewedAt: new Date(),
      reviewedByAdminId: adminId,
      adminNote: note?.slice(0, 2000) ?? undefined,
    },
  });
  return res.count > 0;
}

/**
 * Mark it sent.
 *
 * Reachable from REQUESTED as well as APPROVED, because approving and
 * then paying is one action in practice and forcing two clicks just
 * means the first one gets skipped.
 */
/**
 * Undo a payout marked PAID in error, or one the bank sent back.
 *
 * PAID used to be terminal, which meant a misclick or a bounced
 * transfer permanently subtracted from a member's balance with no way
 * to put it right.
 *
 * It moves to REJECTED rather than back to REQUESTED: `balanceFor`
 * counts REQUESTED and APPROVED as reserved and PAID as spent, so both
 * of those keep the money out of the member's hands. REJECTED is the
 * only status that actually returns it — which is correct, because the
 * withdrawal did not happen. The member sees the reason and can ask
 * again.
 */
export async function reversePayout(id: string, adminId: string, reason: string) {
  const why = reason.trim().slice(0, 500);
  if (!why) return false;
  const res = await prisma.payout.updateMany({
    where: { id, status: "PAID" },
    data: {
      status: "REJECTED",
      paidAt: null,
      reviewedAt: new Date(),
      reviewedByAdminId: adminId,
      rejectionReason: why,
    },
  });
  return res.count > 0;
}

export async function markPaid(
  id: string,
  adminId: string,
  externalRef?: string,
  note?: string,
) {
  const res = await prisma.payout.updateMany({
    where: { id, status: { in: ["REQUESTED", "APPROVED"] } },
    data: {
      status: "PAID",
      paidAt: new Date(),
      reviewedAt: new Date(),
      reviewedByAdminId: adminId,
      externalRef: externalRef?.trim()?.slice(0, 160) || null,
      adminNote: note?.slice(0, 2000) ?? undefined,
    },
  });
  return res.count > 0;
}

/** Declining releases the reservation, so the money is available again. */
export async function rejectPayout(id: string, adminId: string, reason: string) {
  const clean = reason.trim().slice(0, 2000);
  if (!clean) return false;
  const res = await prisma.payout.updateMany({
    where: { id, status: { in: ["REQUESTED", "APPROVED"] } },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedByAdminId: adminId,
      rejectionReason: clean,
    },
  });
  return res.count > 0;
}

/** Headline numbers for the top of the admin queue. */
export async function payoutTotals() {
  const rows = await prisma.payout.groupBy({
    by: ["status"],
    _count: { _all: true },
    _sum: { amountCents: true, feeCents: true, netCents: true },
  });
  const by: Record<string, { count: number; amountCents: number; feeCents: number; netCents: number }> = {};
  for (const r of rows) {
    by[r.status] = {
      count: r._count._all,
      amountCents: r._sum.amountCents ?? 0,
      feeCents: r._sum.feeCents ?? 0,
      netCents: r._sum.netCents ?? 0,
    };
  }
  return by;
}
