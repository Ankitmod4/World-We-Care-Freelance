"use client";

/**
 * Getting paid — balance, payout methods, and withdrawal requests.
 *
 * The fee is shown as a worked line before the button, not as a
 * percentage in the small print: "you'll receive $99.00" is the number
 * the member cares about, and finding out about the fee after
 * submitting is how trust in a payment system goes.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents, parseAmountToCents, splitFee } from "@/lib/money";
import { useT } from "./locale-context";
import { serverText, type TFunction } from "@/lib/i18n-core";

interface Method {
  id: string;
  type: "PAYPAL" | "BANK" | "WISE" | "CHECK";
  typeLabel: string;
  label: string | null;
  displayHint: string;
  isDefault: boolean;
  readable: boolean;
}

interface Payout {
  id: string;
  amountCents: number;
  feeCents: number;
  netCents: number;
  status: "REQUESTED" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED";
  requestedAt: string;
  paidAt: string | null;
  rejectionReason: string | null;
  methodSnapshot: { displayHint?: string } | null;
}

interface Balance {
  availableCents: number;
  onHoldCents: number;
  reservedCents: number;
  paidOutCents: number;
  lifetimeCents: number;
}

interface Limits {
  enabled: boolean;
  minCents: number;
  feeBasisPoints: number;
  holdDays: number;
  currency: string;
  allowedMethods: string[];
}

const money = (cents: number, currency = "usd") => formatCents(cents, currency);
const when = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

/** Literal `t()` calls, so the extractor can see them. See header-nav. */
function payoutFields(
  t: TFunction,
): Record<Method["type"], { name: string; label: string; hint?: string }[]> {
  return {
    PAYPAL: [{ name: "email", label: t("payouts.paypalEmail", "PayPal email") }],
    WISE: [{ name: "email", label: t("payouts.wiseEmail", "Wise email") }],
    BANK: [
      { name: "accountName", label: t("payouts.accountName", "Name on the account") },
      { name: "bankName", label: t("payouts.bankName", "Bank name") },
      {
        name: "accountNumber",
        label: t("payouts.accountNumber", "Account number"),
        hint: t("payouts.accountNumberHint", "Or leave blank and use an IBAN"),
      },
      { name: "routingNumber", label: t("payouts.routing", "Routing / sort code") },
      {
        name: "iban",
        label: t("payouts.iban", "IBAN"),
        hint: t("payouts.ibanHint", "International accounts"),
      },
      { name: "swift", label: t("payouts.swift", "SWIFT / BIC") },
      {
        name: "country",
        label: t("payouts.countryCode", "Country code"),
        hint: t("payouts.countryCodeHint", "Two letters, e.g. US"),
      },
    ],
    CHECK: [
      { name: "payeeName", label: t("payouts.payeeName", "Payee name") },
      { name: "line1", label: t("payouts.line1", "Address line 1") },
      { name: "line2", label: t("payouts.line2", "Address line 2") },
      { name: "city", label: t("eventNew.city", "City") },
      { name: "state", label: t("payouts.state", "State / region") },
      { name: "postcode", label: t("placeNew.postcode", "Postcode") },
      { name: "country", label: t("payouts.countryCode", "Country code") },
    ],
  };
}

/**
 * Proper casing, and NOT translated.
 *
 * PayPal and Wise are company names, and a translation of a brand is
 * a brand somebody cannot find in their banking app. Only the two
 * that are descriptions rather than names get a `t()`.
 */
function typeLabels(t: TFunction): Record<Method["type"], string> {
  return {
    PAYPAL: "PayPal",
    WISE: "Wise",
    BANK: t("payouts.bankTransfer", "Bank transfer"),
    CHECK: t("payouts.postedCheque", "Posted cheque"),
  };
}

const BADGE: Record<Payout["status"], string> = {
  REQUESTED: "bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)]",
  APPROVED: "bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)]",
  PAID: "bg-[color:var(--color-success-soft)] text-[color:var(--color-success-ink)]",
  REJECTED: "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger-ink)]",
  CANCELLED: "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-subtle)]",
};

export function PayoutsClient() {
  const t = useT();
  const FIELDS = payoutFields(t);
  const TYPE_LABEL = typeLabels(t);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [methods, setMethods] = useState<Method[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [limits, setLimits] = useState<Limits | null>(null);

  const [amount, setAmount] = useState("");
  const [methodId, setMethodId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [adding, setAdding] = useState<Method["type"] | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/user/payouts", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const d = (await res.json()) as {
      balance: Balance; methods: Method[]; payouts: Payout[]; limits: Limits;
    };
    setBalance(d.balance);
    setMethods(d.methods ?? []);
    setPayouts(d.payouts ?? []);
    setLimits(d.limits);
    setMethodId((prev) => prev || d.methods?.find((m) => m.isDefault)?.id || d.methods?.[0]?.id || "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Same guarded parser the donation form uses, for the same reason:
  // a stripped comma turns "1,50" into a request for 150 units.
  const typed = amount.trim();
  const parsedCents = typed ? parseAmountToCents(typed) : null;
  const unreadable = typed !== "" && parsedCents === null;
  const cents = parsedCents ?? 0;
  // splitFee, not a re-derivation of it. The number quoted here has to
  // be the number the server computes, or the member is shown one fee
  // and charged another.
  const { feeCents, netCents } = limits
    ? splitFee(cents, limits.feeBasisPoints)
    : { feeCents: 0, netCents: cents };

  const request = async () => {
    setBusy(true);
    setError(null);
    setFlash(null);
    const res = await fetch("/api/user/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents: cents, methodId }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(serverText(t, d?.error) || t("payouts.requestFailed", "Couldn't send that request."));
      return;
    }
    setAmount("");
    setFlash(t("payouts.requested", "Requested. You'll hear when it's been sent."));
    void load();
  };

  const addMethod = async () => {
    if (!adding) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/user/payouts/methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: adding, details: fields }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(serverText(t, d?.error) || t("payouts.saveMethodFailed", "Couldn't save that method."));
      return;
    }
    setAdding(null);
    setFields({});
    void load();
  };

  const removeMethod = async (id: string) => {
    if (!window.confirm(t("payouts.removeConfirm", "Remove this payout method?"))) return;
    const res = await fetch(`/api/user/payouts/methods/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(serverText(t, d?.error) || t("payouts.removeFailed", "Couldn't remove it."));
      return;
    }
    void load();
  };

  const makeDefault = async (id: string) => {
    await fetch(`/api/user/payouts/methods/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    }).catch(() => null);
    void load();
  };

  const cancel = async (id: string) => {
    if (!window.confirm(t("payouts.cancelConfirm", "Cancel this withdrawal request?"))) return;
    const res = await fetch(`/api/user/payouts/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(serverText(t, d?.error) || t("payouts.cancelFailed", "Couldn't cancel it."));
      return;
    }
    void load();
  };

  const card =
    "rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card";
  const fieldLabel = "mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]";

  const allowed = (limits?.allowedMethods ?? []) as Method["type"][];
  const ccy = limits?.currency ?? "usd";
  const canRequest =
    !unreadable &&
    !!limits?.enabled &&
    !!methodId &&
    cents >= (limits?.minCents ?? 0) &&
    cents <= (balance?.availableCents ?? 0) &&
    netCents > 0;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("menu.gettingPaid", "Getting paid")}</h1>
        <p className="mt-0.5 text-[13.5px] text-[color:var(--color-text-muted)]">
          {t("payouts.subtitle", "Where your donations go, and how to withdraw them.")}
        </p>
      </header>

      {/* ── balance ── */}
      {balance && (
        <div className={`${card} p-5`}>
          <p className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
            {t("payouts.ready", "Ready to withdraw")}
          </p>
          <p className="text-[30px] font-semibold leading-tight tabular-nums">
            {money(balance.availableCents, ccy)}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-4">
            {[
              [t("payouts.clearing", "Still clearing"), balance.onHoldCents],
              [t("payouts.requestedLabel", "Requested"), balance.reservedCents],
              [t("payouts.paidOut", "Paid out"), balance.paidOutCents],
              [t("payouts.lifetime", "Received in total"), balance.lifetimeCents],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt className="text-[color:var(--color-text-subtle)]">{k}</dt>
                <dd className="font-semibold tabular-nums">{money(Number(v))}</dd>
              </div>
            ))}
          </dl>
          {balance.onHoldCents > 0 && limits && (
            <p className="mt-3 text-[12.5px] leading-relaxed text-[color:var(--color-text-subtle)]">
              Donations become available {limits.holdDays} days after they arrive, so a
              refund can&apos;t leave you owing money that has already been sent.
            </p>
          )}
        </div>
      )}

      {/* ── methods ── */}
      <div className={`${card} p-5`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">{t("payouts.methods", "Payout methods")}</h2>
            <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
              {t(
                "payouts.methodsBlurb",
                "Your details are encrypted, and only read when a payment is being sent.",
              )}
            </p>
          </div>
        </div>

        {methods.length > 0 && (
          <div className="mt-4 divide-y divide-[color:var(--color-border-soft)]">
            {methods.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13.5px] font-medium">
                    <span className="truncate">{m.label || m.typeLabel}</span>
                    {m.isDefault && (
                      <span className="rounded-full bg-[color:var(--color-brand-soft)] px-2 py-0.5 text-[10.5px] font-semibold text-[color:var(--color-brand-ink)]">
                        {t("payouts.default", "Default")}
                      </span>
                    )}
                  </p>
                  <p className="text-[12px] text-[color:var(--color-text-subtle)]">
                    {m.displayHint}
                  </p>
                  {!m.readable && (
                    <p className="mt-0.5 text-[12px] text-[color:var(--color-danger)]">
                      {t(
                        "payouts.unreadable",
                        "These details can't be read any more — remove this and add it again.",
                      )}
                    </p>
                  )}
                </div>
                {!m.isDefault && (
                  <button
                    type="button"
                    onClick={() => void makeDefault(m.id)}
                    className="text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline"
                  >
                    {t("payouts.makeDefault", "Make default")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void removeMethod(m.id)}
                  className="text-[12.5px] font-medium text-[color:var(--color-danger)] hover:underline"
                >
                  {t("payouts.remove", "Remove")}
                </button>
              </div>
            ))}
          </div>
        )}

        {adding ? (
          <div className="mt-4 space-y-2 rounded-[12px] border border-[color:var(--color-border)] p-4">
            <p className="text-[13.5px] font-semibold">
              {t("payouts.addDetails", "Add {type} details", { type: TYPE_LABEL[adding] })}
            </p>
            {/* Columns follow the field COUNT, not the viewport alone.
                PayPal and Wise ask for one thing — an email address —
                and a lone input sitting in a three-column grid ends up
                a third of the card wide, which looks like a mistake
                rather than a form. */}
            <div
              className={
                FIELDS[adding].length === 1
                  ? "grid max-w-2xl gap-2"
                  : FIELDS[adding].length <= 4
                    ? "grid gap-2 sm:grid-cols-2"
                    : "grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
              }
            >
              {FIELDS[adding].map((f) => (
                <label key={f.name} className="block">
                  <span className={fieldLabel}>{f.label}</span>
                  <Input
                    value={fields[f.name] ?? ""}
                    onChange={(e) => setFields({ ...fields, [f.name]: e.target.value })}
                  />
                  {f.hint && (
                    <span className="mt-0.5 block text-[11.5px] text-[color:var(--color-text-subtle)]">
                      {f.hint}
                    </span>
                  )}
                </label>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button loading={busy} onClick={() => void addMethod()}>
                {t("payouts.saveMethod", "Save method")}
              </Button>
              <Button variant="secondary" onClick={() => { setAdding(null); setFields({}); }}>
                {t("common.cancel", "Cancel")}
              </Button>
            </div>
          </div>
        ) : allowed.length === 0 ? (
          <p className="mt-4 text-[13px] text-[color:var(--color-text-muted)]">
            {t("payouts.noneAccepted", "No payout methods are being accepted at the moment.")}
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {allowed.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setAdding(t); setFields({}); setError(null); }}
                className="inline-flex h-9 items-center rounded-full border border-[color:var(--color-border)] px-3.5 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-text)]"
              >
                + {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── request ── */}
      {balance && limits?.enabled && methods.length > 0 && (
        <div className={`${card} p-5`}>
          <h2 className="text-[15px] font-semibold">{t("payouts.withdraw", "Withdraw")}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:max-w-2xl">
            <label className="block">
              <span className={fieldLabel}>{t("payouts.amount", "Amount ($)")}</span>
              <Input
                value={amount}
                inputMode="decimal"
                onChange={(e) => setAmount(e.target.value)}
                placeholder={(balance.availableCents / 100).toFixed(2)}
              />
            </label>
            <label className="block">
              <span className={fieldLabel}>{t("payouts.sendTo", "Send it to")}</span>
              <select
                value={methodId}
                onChange={(e) => setMethodId(e.target.value)}
                className="h-11 w-full rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[14px] focus:border-[color:var(--color-brand)] focus:outline-none"
              >
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label || m.typeLabel} — {m.displayHint}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {unreadable && (
            <p className="mt-3 text-[13px] text-[color:var(--color-danger)]">
              {t("donate.badAmount", "Enter an amount like 25 or 25.50.")}
            </p>
          )}

          {cents > 0 && (
            <p className="mt-3 rounded-[12px] bg-[color:var(--color-surface-muted)] px-3.5 py-2.5 text-[13px] leading-relaxed">
              {t(
                "payouts.summary",
                "You're withdrawing {gross}. WorldWeCare keeps {fee} ({pct}%), so you'll receive {net}.",
                {
                  gross: money(cents, ccy),
                  fee: money(feeCents, ccy),
                  pct: (limits.feeBasisPoints / 100).toFixed(2),
                  net: money(netCents, ccy),
                },
              )}
              {cents > balance.availableCents && (
                <span className="mt-1 block text-[color:var(--color-danger)]">
                  {t("payouts.tooMuch", "That's more than the {amount} you have available.", {
                    amount: money(balance.availableCents, ccy),
                  })}
                </span>
              )}
              {cents > 0 && cents < limits.minCents && (
                <span className="mt-1 block text-[color:var(--color-danger)]">
                  {t("payouts.tooSmall", "The smallest withdrawal is {amount}.", {
                    amount: money(limits.minCents, ccy),
                  })}
                </span>
              )}
            </p>
          )}

          <div className="mt-3">
            <Button loading={busy} disabled={!canRequest} onClick={() => void request()}>
              {t("payouts.request", "Request withdrawal")}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-[13px] text-[color:var(--color-danger)]">{error}</p>}
      {flash && <p className="text-[13px] text-[color:var(--color-success-ink)]">{flash}</p>}

      {/* ── history ── */}
      {payouts.length > 0 && (
        <div className={card}>
          <h2 className="px-5 pt-5 text-[15px] font-semibold">
            {t("payouts.history", "Withdrawal history")}
          </h2>
          <div className="mt-2 divide-y divide-[color:var(--color-border-soft)]">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-start gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13.5px] font-medium">
                    {money(p.netCents)}
                    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${BADGE[p.status]}`}>
                      {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12px] text-[color:var(--color-text-subtle)]">
                    {when(p.requestedAt)} · {p.methodSnapshot?.displayHint ?? "—"} ·{" "}
                    {money(p.amountCents)} less {money(p.feeCents)} fee
                  </p>
                  {p.rejectionReason && (
                    <p className="mt-1 text-[12.5px] text-[color:var(--color-danger)]">
                      {p.rejectionReason}
                    </p>
                  )}
                </div>
                {p.status === "REQUESTED" && (
                  <button
                    type="button"
                    onClick={() => void cancel(p.id)}
                    className="shrink-0 text-[12.5px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-danger)]"
                  >
                    {t("common.cancel", "Cancel")}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="h-3" />
        </div>
      )}
    </div>
  );
}
