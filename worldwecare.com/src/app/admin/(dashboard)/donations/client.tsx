"use client";

/**
 * The donations ledger — money in, to match the payout queue's money
 * out.
 *
 * There was no such page. An admin could see every withdrawal request
 * and not one donation: not what came in, not who from, not that a
 * chargeback had landed, and not that the Stripe webhook had gone
 * quiet and stranded every payment of the last three days. The failure
 * this is really built for is that last one, which is why "waiting on
 * Stripe" is a banner and not a tab.
 *
 * The donor's name IS shown on an anonymous gift, because an admin
 * handling a refund or a complaint has to know who paid. It is marked
 * anonymous so it is never repeated back to the recipient.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/money";

interface Row {
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
  recipientName: string | null;
  causeTitle: string | null;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  createdAt: string;
  succeededAt: string | null;
  availableAt: string | null;
  disputedAt: string | null;
}

interface Totals {
  byStatus: Record<string, { count: number; grossCents: number; netCents: number }>;
  collectedCents: number;
  stripeFeesCents: number;
  feeUnknownCount: number;
  strandedCount: number;
}

const money = (cents: number, currency = "usd") => formatCents(cents, currency);
const when = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

const TABS = ["SUCCEEDED", "PENDING", "REFUNDED", "DISPUTED", "FAILED", "ALL"] as const;

const BADGE: Record<string, string> = {
  SUCCEEDED: "bg-[color:var(--color-success-soft)] text-[color:var(--color-success-ink)]",
  PENDING: "bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)]",
  REFUNDED: "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-subtle)]",
  DISPUTED: "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger-ink)]",
  FAILED: "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-subtle)]",
};

const LABEL: Record<string, string> = {
  SUCCEEDED: "Received",
  PENDING: "Waiting on Stripe",
  REFUNDED: "Refunded",
  DISPUTED: "Charged back",
  FAILED: "Failed",
  ALL: "All",
};

export function AdminDonationsClient() {
  const [status, setStatus] = useState<string>("SUCCEEDED");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    const url = `/api/admin/donations?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setError("Couldn't load the donations.");
      setRows([]);
      return;
    }
    const d = (await res.json()) as { donations: Row[]; totals: Totals };
    setError(null);
    setRows(d.donations);
    setTotals(d.totals);
  }, [status, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const ccy = rows?.[0]?.currency ?? "usd";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Donations</h1>
          <p className="mt-0.5 text-[13.5px] text-[color:var(--color-text-muted)]">
            Everything that came in, and what happened to it.
          </p>
        </div>
        <Link href="/admin/payouts">
          <Button variant="secondary" size="sm">Payouts</Button>
        </Link>
      </div>

      {/* The one that means something is broken RIGHT NOW. A donation
          that reached Stripe and never came back is a webhook that
          isn't being delivered, and every minute it stays that way is
          another donor charged and not credited. */}
      {totals && totals.strandedCount > 0 && (
        <button
          type="button"
          onClick={() => setStatus("PENDING")}
          className="w-full rounded-[12px] border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] px-4 py-2.5 text-left text-[13px] font-medium text-[color:var(--color-danger-ink)]"
        >
          {totals.strandedCount} donation{totals.strandedCount === 1 ? "" : "s"} reached Stripe and
          were never confirmed. That is the webhook, not the payment — check the endpoint and
          signing secret in Stripe settings.
        </button>
      )}

      {totals && totals.feeUnknownCount > 0 && (
        <p className="rounded-[12px] border border-[color:var(--color-warning-soft)] bg-[color:var(--color-warning-soft)] px-4 py-2.5 text-[13px] text-[color:var(--color-warning-ink)]">
          {totals.feeUnknownCount} donation{totals.feeUnknownCount === 1 ? " was" : "s were"}{" "}
          credited without a readable Stripe fee, so the platform absorbed it.
        </p>
      )}

      {totals && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Collected", money(totals.collectedCents, ccy), "after refunds and chargebacks"],
            ["Stripe kept", money(totals.stripeFeesCents, ccy), "processing fees"],
            ["Charged back", money(totals.byStatus.DISPUTED?.grossCents ?? 0, ccy),
              `${totals.byStatus.DISPUTED?.count ?? 0} donation${(totals.byStatus.DISPUTED?.count ?? 0) === 1 ? "" : "s"}`],
            ["Refunded", money(totals.byStatus.REFUNDED?.grossCents ?? 0, ccy),
              `${totals.byStatus.REFUNDED?.count ?? 0} donation${(totals.byStatus.REFUNDED?.count ?? 0) === 1 ? "" : "s"}`],
          ].map(([label, value, hint]) => (
            <div
              key={label}
              className="rounded-[14px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-3.5 shadow-card"
            >
              <dt className="text-[12px] font-medium text-[color:var(--color-text-muted)]">{label}</dt>
              <dd className="mt-0.5 text-[19px] font-semibold tabular-nums">{value}</dd>
              <dd className="text-[11.5px] text-[color:var(--color-text-subtle)]">{hint}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setStatus(t)}
              className={`h-8 rounded-full px-3.5 text-[12.5px] font-medium transition-colors ${
                status === t
                  ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
                  : "border border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-brand)]"
              }`}
            >
              {LABEL[t]}
              {totals?.byStatus[t]?.count ? ` ${totals.byStatus[t].count}` : ""}
            </button>
          ))}
        </div>
        <div className="ml-auto w-full max-w-[18rem]">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email, cause or Stripe id"
          />
        </div>
      </div>

      {error && <p className="text-[13px] text-[color:var(--color-danger)]">{error}</p>}

      {rows === null ? (
        <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center shadow-card">
          <p className="text-[15px] font-medium">Nothing here</p>
          <p className="mx-auto mt-1 max-w-[46ch] text-[13.5px] text-[color:var(--color-text-muted)]">
            {q ? "Nothing matches that search." : "No donations with this status yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-[13px]">
              <thead className="border-b border-[color:var(--color-border-soft)] text-[11.5px] uppercase tracking-[0.06em] text-[color:var(--color-text-subtle)]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">From</th>
                  <th className="px-4 py-2.5 font-medium">For</th>
                  <th className="px-4 py-2.5 font-medium">To</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-4 py-2.5 text-right font-medium">Fee</th>
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border-soft)]">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3">
                      <span className="font-medium">{r.donorName ?? "Someone"}</span>
                      {r.isAnonymous && (
                        <span className="ml-1.5 rounded-full bg-[color:var(--color-surface-muted)] px-1.5 py-0.5 text-[10.5px] font-medium text-[color:var(--color-text-subtle)]">
                          anonymous
                        </span>
                      )}
                      {r.donorEmail && (
                        <span className="block text-[11.5px] text-[color:var(--color-text-subtle)]">
                          {r.donorEmail}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.causeTitle ?? <span className="text-[color:var(--color-text-subtle)]">—</span>}
                      {r.message && (
                        <span className="mt-0.5 block max-w-[24ch] truncate text-[11.5px] italic text-[color:var(--color-text-subtle)]">
                          “{r.message}”
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.recipientName ?? (
                        <span className="text-[color:var(--color-text-subtle)]">WorldWeCare</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {money(r.grossCents, r.currency)}
                      {r.refundedCents > 0 && (
                        <span className="block text-[11.5px] text-[color:var(--color-text-subtle)]">
                          −{money(r.refundedCents, r.currency)} back
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[color:var(--color-text-muted)]">
                      {r.feeUnknown ? (
                        <span className="text-[color:var(--color-warning-ink)]">unknown</span>
                      ) : (
                        money(r.stripeFeeCents, r.currency)
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[color:var(--color-text-muted)]">
                      {when(r.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          BADGE[r.status] ?? BADGE.FAILED
                        }`}
                      >
                        {LABEL[r.status] ?? r.status}
                      </span>
                      {/* The Stripe id, so a row here and a row in the
                          Stripe dashboard can actually be matched up. */}
                      {(r.stripePaymentIntentId ?? r.stripeSessionId) && (
                        <span className="mt-1 block max-w-[16ch] truncate font-mono text-[10.5px] text-[color:var(--color-text-subtle)]">
                          {r.stripePaymentIntentId ?? r.stripeSessionId}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
