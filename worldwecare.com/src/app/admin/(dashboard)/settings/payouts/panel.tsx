"use client";

/**
 * Payout policy.
 *
 * The fee is stored in BASIS POINTS, not a percentage — 100 bp is 1%.
 * The field accepts a percentage because that is what a human means,
 * and converts on the way in and out, so a rate like 1.5% is exact
 * rather than a float that rounds to something almost right.
 *
 * The worked example under the field is doing real work: a percentage
 * on its own is abstract, and "on a $100 withdrawal you keep $1 and
 * they receive $99" is the sentence that catches a misplaced decimal
 * point before it reaches a member.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clampBp, parseAmountToCents } from "@/lib/money";

const ALL_METHODS = [
  { v: "PAYPAL", label: "PayPal" },
  { v: "BANK", label: "Bank transfer" },
  { v: "WISE", label: "Wise" },
  { v: "CHECK", label: "Posted cheque" },
];

interface Settings {
  payoutFeeBasisPoints: number;
  payoutMinCents: number;
  payoutHoldDays: number;
  payoutMethods: string[];
  currency: string;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function PayoutSettingsPanel({ canEdit }: { canEdit: boolean }) {
  const [s, setS] = useState<Settings | null>(null);
  const [feePercent, setFeePercent] = useState("1");
  const [minDollars, setMinDollars] = useState("10.00");
  const [holdDays, setHoldDays] = useState("14");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/payments/settings", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setError("Couldn't load the payout settings.");
      return;
    }
    const d = (await res.json()) as { settings: Settings };
    setS(d.settings);
    setFeePercent(String(d.settings.payoutFeeBasisPoints / 100));
    setMinDollars((d.settings.payoutMinCents / 100).toFixed(2));
    setHoldDays(String(d.settings.payoutHoldDays));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // clampBp is the server's own guard; using it here means the
  // percentage shown and the percentage stored cannot disagree.
  const bp = clampBp(Math.round((Number(feePercent) || 0) * 100));
  const minCents = parseAmountToCents(minDollars);

  const save = async () => {
    if (!s) return;
    if (minCents === null) {
      setError("Enter the smallest withdrawal as a plain amount, like 10.00.");
      return;
    }
    setSaving(true);
    setError(null);
    setFlash(null);
    const res = await fetch("/api/admin/payments/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payoutFeeBasisPoints: bp,
        payoutMinCents: minCents,
        payoutHoldDays: Math.max(0, Math.round(Number(holdDays) || 0)),
        payoutMethods: s.payoutMethods,
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(d?.error ?? "Couldn't save.");
      return;
    }
    setFlash("Saved.");
    void load();
  };

  if (!s) return <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>;

  const label = "mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]";
  const section =
    "rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-5 shadow-card";

  // The example everyone actually checks the number against.
  const example = 10_000;
  const exFee = Math.round((example * bp) / 10_000);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
      <div className={section}>
        <h2 className="text-[15px] font-semibold">What WorldWeCare keeps</h2>
        <div className="mt-4 space-y-3">
          <label className="block max-w-[12rem]">
            <span className={label}>Fee on each withdrawal (%)</span>
            <Input
              value={feePercent}
              disabled={!canEdit}
              inputMode="decimal"
              onChange={(e) => setFeePercent(e.target.value)}
            />
          </label>
          <p className="rounded-[12px] bg-[color:var(--color-surface-muted)] px-3.5 py-2.5 text-[13px] leading-relaxed">
            On a <strong>{money(example)}</strong> withdrawal, WorldWeCare keeps{" "}
            <strong>{money(exFee)}</strong> and the member receives{" "}
            <strong>{money(example - exFee)}</strong>.
            {bp === 0 && " A zero fee means withdrawals are free."}
            {bp >= 5000 && " That is over half of what they asked for — check the number."}
          </p>
        </div>
      </div>

      <div className={section}>
        <h2 className="text-[15px] font-semibold">Limits</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className={label}>Smallest withdrawal ($)</span>
            <Input
              value={minDollars}
              disabled={!canEdit}
              inputMode="decimal"
              onChange={(e) => setMinDollars(e.target.value)}
            />
          </label>
          <label className="block">
            <span className={label}>Hold period (days)</span>
            <Input
              value={holdDays}
              disabled={!canEdit}
              inputMode="numeric"
              onChange={(e) => setHoldDays(e.target.value)}
            />
          </label>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[color:var(--color-text-subtle)]">
          A donation can&apos;t be withdrawn until the hold has passed. This is what stops
          a refund or chargeback arriving after the money has already gone out —
          set it to 0 only if you are willing to cover that yourself.
        </p>
      </div>

      <div className={section}>
        <h2 className="text-[15px] font-semibold">How members can be paid</h2>
        <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
          You send these by hand. Only turn on the ones you can actually pay.
        </p>
        <div className="mt-3 space-y-2">
          {ALL_METHODS.map((m) => {
            const on = s.payoutMethods.includes(m.v);
            return (
              <label
                key={m.v}
                className={`flex cursor-pointer items-center gap-3 rounded-[12px] border p-3 transition-colors ${
                  on
                    ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-soft)]/40"
                    : "border-[color:var(--color-border)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!canEdit}
                  onChange={() =>
                    setS({
                      ...s,
                      payoutMethods: on
                        ? s.payoutMethods.filter((v) => v !== m.v)
                        : [...s.payoutMethods, m.v],
                    })
                  }
                  className="h-4 w-4 shrink-0 accent-[color:var(--color-brand)]"
                />
                <span className="text-[13.5px] font-medium">{m.label}</span>
              </label>
            );
          })}
        </div>
        {s.payoutMethods.length === 0 && (
          <p className="mt-2 text-[12.5px] text-[color:var(--color-warning-ink)]">
            With none selected, members can&apos;t add a payout method and so can&apos;t
            withdraw at all.
          </p>
        )}
      </div>

      </div>

      {error && <p className="text-[13px] text-[color:var(--color-danger)]">{error}</p>}
      {flash && <p className="text-[13px] text-[color:var(--color-success-ink)]">{flash}</p>}

      {canEdit && (
        <div className="flex justify-end">
          <Button loading={saving} onClick={() => void save()}>Save</Button>
        </div>
      )}
    </div>
  );
}
