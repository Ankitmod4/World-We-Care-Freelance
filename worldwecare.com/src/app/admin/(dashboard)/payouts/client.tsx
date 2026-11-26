"use client";

/**
 * The payout queue.
 *
 * Money leaves the building from this page, so it is built around one
 * question: is it safe to send this, and to where.
 *
 * The member's actual payment details are NOT in the list. They are
 * fetched only when a row is opened, only while the payout is still
 * open, and opening one writes an audit entry. Rendering everyone's
 * bank details in a list would mean a single screenshot of this page
 * leaks the lot.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/money";

interface Payout {
  id: string;
  userId: string;
  userNameSnapshot: string;
  userEmailSnapshot: string | null;
  amountCents: number;
  feeBasisPoints: number;
  feeCents: number;
  netCents: number;
  currency: string;
  methodSnapshot: { type?: string; label?: string | null; displayHint?: string } | null;
  status: "REQUESTED" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED";
  requestedAt: string;
  paidAt: string | null;
  externalRef: string | null;
  rejectionReason: string | null;
  adminNote: string | null;
}

interface Detail {
  payout: Payout;
  details: { type: string; details: Record<string, unknown> } | null;
  balance: {
    availableCents: number;
    onHoldCents: number;
    reservedCents: number;
    paidOutCents: number;
    lifetimeCents: number;
  };
}

const money = (cents: number, currency = "usd") => formatCents(cents, currency);

const TABS = ["REQUESTED", "APPROVED", "PAID", "REJECTED", "CANCELLED", "ALL"] as const;

const BADGE: Record<Payout["status"], string> = {
  REQUESTED: "bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)]",
  APPROVED: "bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)]",
  PAID: "bg-[color:var(--color-success-soft)] text-[color:var(--color-success-ink)]",
  REJECTED: "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger-ink)]",
  CANCELLED: "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-subtle)]",
};

export function AdminPayoutsClient() {
  const [status, setStatus] = useState<string>("REQUESTED");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Payout[] | null>(null);
  const [totals, setTotals] = useState<Record<string, { count: number; amountCents: number }>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [externalRef, setExternalRef] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ status });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/admin/payouts?${params}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setRows([]);
      return;
    }
    const d = (await res.json()) as { payouts: Payout[]; totals: typeof totals };
    setRows(d.payouts ?? []);
    setTotals(d.totals ?? {});
  }, [status, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const openRow = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(id);
    setDetail(null);
    setExternalRef("");
    setNote("");
    setError(null);
    const res = await fetch(`/api/admin/payouts/${id}`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) setDetail((await res.json()) as Detail);
  };

  const act = async (id: string, action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/payouts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, adminNote: note || undefined, ...extra }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(d?.error ?? "That didn't work.");
      return;
    }
    setOpenId(null);
    setDetail(null);
    void load();
  };

  const reverse = (id: string) => {
    // PAID used to be terminal, so a misclick or a transfer the bank
    // sent back permanently took the money off the member's balance
    // with nothing anyone could do about it.
    const reason = window.prompt(
      "Why is this being reversed? The member sees this, and the amount goes back on their balance:",
    );
    if (reason === null) return;
    if (!reason.trim()) {
      window.alert("A reason is required.");
      return;
    }
    void act(id, "reverse", { rejectionReason: reason.trim() });
  };

  const reject = (id: string) => {
    const reason = window.prompt("Why is this being declined? The member sees this:");
    if (reason === null) return;
    if (!reason.trim()) {
      window.alert("A reason is required.");
      return;
    }
    void act(id, "reject", { rejectionReason: reason.trim() });
  };

  const waiting = totals.REQUESTED?.count ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Payouts</h1>
          <p className="mt-0.5 text-[13.5px] text-[color:var(--color-text-muted)]">
            Withdrawal requests. You send the money yourself, then mark it paid here.
          </p>
        </div>
        <Link href="/admin/settings/payouts">
          <Button variant="secondary" size="sm">Payout settings</Button>
        </Link>
      </div>

      {waiting > 0 && status !== "REQUESTED" && (
        <button
          type="button"
          onClick={() => setStatus("REQUESTED")}
          className="w-full rounded-[12px] border border-[color:var(--color-warning-soft)] bg-[color:var(--color-warning-soft)] px-4 py-2.5 text-left text-[13px] font-medium text-[color:var(--color-warning-ink)]"
        >
          {waiting} request{waiting === 1 ? "" : "s"} waiting —{" "}
          {money(totals.REQUESTED?.amountCents ?? 0)} in total. Open the queue.
        </button>
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
              {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
              {totals[t]?.count ? ` ${totals[t].count}` : ""}
            </button>
          ))}
        </div>
        <div className="ml-auto w-full max-w-[16rem]">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or reference" />
        </div>
      </div>

      {error && <p className="text-[13px] text-[color:var(--color-danger)]">{error}</p>}

      {rows === null ? (
        <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center shadow-card">
          <p className="text-[15px] font-medium">
            {status === "REQUESTED" ? "Nothing waiting" : "Nothing here"}
          </p>
          <p className="mx-auto mt-1 max-w-[46ch] text-[13.5px] text-[color:var(--color-text-muted)]">
            {status === "REQUESTED"
              ? "Every withdrawal request has been dealt with."
              : "Try another tab."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <div
              key={p.id}
              className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card"
            >
              <button
                type="button"
                onClick={() => void openRow(p.id)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[14px] font-semibold">
                    <span className="truncate">{p.userNameSnapshot}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${BADGE[p.status]}`}>
                      {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-[color:var(--color-text-subtle)]">
                    {p.methodSnapshot?.displayHint ?? "No method"} ·{" "}
                    {new Date(p.requestedAt).toLocaleDateString()}
                    {p.externalRef ? ` · ref ${p.externalRef}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {/* Net is the number that matters — it's what you send. */}
                  <p className="text-[15px] font-semibold tabular-nums">{money(p.netCents)}</p>
                  <p className="text-[11.5px] text-[color:var(--color-text-subtle)] tabular-nums">
                    {money(p.amountCents)} − {money(p.feeCents)} fee
                  </p>
                </div>
              </button>

              {openId === p.id && (
                <div className="border-t border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] p-4">
                  {!detail ? (
                    <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)]">
                            Send to
                          </p>
                          {detail.details ? (
                            <dl className="space-y-0.5 text-[13px]">
                              {Object.entries(detail.details.details).map(([k, v]) =>
                                v ? (
                                  <div key={k} className="flex gap-2">
                                    <dt className="w-32 shrink-0 text-[color:var(--color-text-subtle)]">
                                      {k.replace(/([A-Z])/g, " $1").toLowerCase()}
                                    </dt>
                                    <dd className="min-w-0 break-all font-medium">{String(v)}</dd>
                                  </div>
                                ) : null,
                              )}
                            </dl>
                          ) : (
                            <p className="text-[13px] text-[color:var(--color-text-muted)]">
                              {p.status === "REQUESTED" || p.status === "APPROVED"
                                ? "The stored details can't be read — ask the member to re-add their payout method."
                                : "Details are only shown while a payout is still open."}
                            </p>
                          )}
                        </div>

                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)]">
                            Their balance
                          </p>
                          <dl className="space-y-0.5 text-[13px]">
                            {[
                              ["Available", detail.balance.availableCents],
                              ["On hold", detail.balance.onHoldCents],
                              ["Reserved", detail.balance.reservedCents],
                              ["Paid out", detail.balance.paidOutCents],
                              ["Received", detail.balance.lifetimeCents],
                            ].map(([k, v]) => (
                              <div key={String(k)} className="flex gap-2">
                                <dt className="w-24 shrink-0 text-[color:var(--color-text-subtle)]">{k}</dt>
                                <dd className="font-medium tabular-nums">{money(Number(v))}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      </div>

                      {p.status === "PAID" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="secondary" disabled={busy} onClick={() => reverse(p.id)}>
                            Reverse — it came back
                          </Button>
                          <span className="text-[12px] text-[color:var(--color-text-subtle)]">
                            Puts {money(p.netCents)} back on their balance.
                          </span>
                        </div>
                      )}

                      {(p.status === "REQUESTED" || p.status === "APPROVED") && (
                        <div className="space-y-2 border-t border-[color:var(--color-border)] pt-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="block">
                              <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
                                Reference — PayPal id, bank ref, cheque number
                              </span>
                              <Input
                                value={externalRef}
                                onChange={(e) => setExternalRef(e.target.value)}
                                placeholder="Optional, but worth recording"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
                                Note — admin only
                              </span>
                              <Input value={note} onChange={(e) => setNote(e.target.value)} />
                            </label>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              loading={busy}
                              onClick={() => void act(p.id, "paid", { externalRef })}
                            >
                              Mark paid — {money(p.netCents)} sent
                            </Button>
                            {p.status === "REQUESTED" && (
                              <Button
                                variant="secondary"
                                disabled={busy}
                                onClick={() => void act(p.id, "approve")}
                              >
                                Approve only
                              </Button>
                            )}
                            <Button variant="secondary" disabled={busy} onClick={() => reject(p.id)}>
                              Decline
                            </Button>
                          </div>
                        </div>
                      )}

                      {p.rejectionReason && (
                        <p className="text-[12.5px] text-[color:var(--color-danger)]">
                          <span className="font-semibold">Declined: </span>
                          {p.rejectionReason}
                        </p>
                      )}
                      {p.adminNote && (
                        <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
                          <span className="font-semibold">Note: </span>
                          {p.adminNote}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
