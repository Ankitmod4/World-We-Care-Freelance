"use client";

/**
 * Stripe connection settings.
 *
 * ── SECRETS ARE WRITE-ONLY HERE ──
 *
 * The secret key and webhook signing secret are never sent back to the
 * browser — the form shows a masked hint and an empty input. Leaving
 * the input blank means "keep what's stored"; typing replaces it.
 * Round-tripping the real key would turn one leaked admin session into
 * a compromised Stripe account.
 *
 * ── THE TEST BUTTON TESTS WHAT YOU TYPED ──
 *
 * It posts the key currently in the field, so a key can be checked
 * before it is saved. A button that could only test the stored key
 * would be useless for the moment it exists for: setting Stripe up for
 * the first time.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { parseAmountToCents } from "@/lib/money";
import { REQUIRED_STRIPE_EVENTS } from "@/lib/stripe-events";

interface Settings {
  enabled: boolean;
  mode: "test" | "live";
  publishableKey: string;
  currency: string;
  creditRecipient: "net" | "gross";
  minDonationCents: number;
  maxDonationCents: number;
  secretKeyMasked: string | null;
  webhookSecretMasked: string | null;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
}

interface TestResult {
  ok: boolean;
  message: string;
  accountName?: string;
  country?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  livemode?: boolean;
  modeMismatch?: boolean;
}

const dollars = (cents: number) => (cents / 100).toFixed(2);
// Returns null on anything it can't read, so a mistyped limit is
// refused rather than silently saved as $0.00 — which, for the
// minimum donation, means no minimum at all.
const toCents = (v: string) => parseAmountToCents(v);

export function PaymentsPanel({ canEdit }: { canEdit: boolean }) {
  const [s, setS] = useState<Settings | null>(null);
  const [encryptionReady, setEncryptionReady] = useState(true);
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [minDollars, setMinDollars] = useState("1.00");
  const [maxDollars, setMaxDollars] = useState("5000.00");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/payments/settings", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setError("Couldn't load the payment settings.");
      return;
    }
    const d = (await res.json()) as { settings: Settings; encryptionReady: boolean };
    setS(d.settings);
    setEncryptionReady(d.encryptionReady);
    setMinDollars(dollars(d.settings.minDonationCents));
    setMaxDollars(dollars(d.settings.maxDonationCents));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (v: Partial<Settings>) => setS((prev) => (prev ? { ...prev, ...v } : prev));

  const minCents = toCents(minDollars);
  const maxCents = toCents(maxDollars);
  const limitsUnreadable = minCents === null || maxCents === null;

  const save = async () => {
    if (limitsUnreadable) {
      setError("Enter the donation limits as plain amounts, like 1.00 and 5000.00.");
      return;
    }
    if (!s) return;
    setSaving(true);
    setError(null);
    setFlash(null);
    const res = await fetch("/api/admin/payments/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: s.enabled,
        mode: s.mode,
        publishableKey: s.publishableKey,
        creditRecipient: s.creditRecipient,
        minDonationCents: minCents,
        maxDonationCents: maxCents,
        // Blank means unchanged.
        secretKey: secretKey || undefined,
        webhookSecret: webhookSecret || undefined,
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(d?.error ?? "Couldn't save.");
      return;
    }
    // Cleared so the masked hint reappears and the real key isn't left
    // sitting in a DOM input.
    setSecretKey("");
    setWebhookSecret("");
    setFlash("Saved.");
    void load();
  };

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    const res = await fetch("/api/admin/payments/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secretKey: secretKey || undefined }),
    }).catch(() => null);
    setTesting(false);
    if (!res) {
      setTest({ ok: false, message: "Couldn't reach the server." });
      return;
    }
    setTest((await res.json()) as TestResult);
  };

  if (!s) {
    return <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>;
  }

  const label = "mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]";
  const section =
    "rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-5 shadow-card";

  return (
    <div className="space-y-5">
      {!encryptionReady && (
        <p className="rounded-[12px] border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[color:var(--color-danger-ink)]">
          <strong>PAYMENTS_SECRET isn&apos;t set on the server.</strong> Keys can&apos;t be
          stored safely until it is, so saving is disabled. Add it to the environment
          and restart.
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
      {/* ── connection ── */}
      <div className={section}>
        <h2 className="text-[15px] font-semibold">Connection</h2>
        <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
          From your Stripe dashboard, under Developers → API keys.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <span className={label}>Mode</span>
            <div className="flex gap-1.5">
              {(["test", "live"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => patch({ mode: m })}
                  className={`h-9 rounded-full px-4 text-[13px] font-medium transition-colors disabled:opacity-50 ${
                    s.mode === m
                      ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
                      : "border border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-brand)]"
                  }`}
                >
                  {m === "test" ? "Test" : "Live"}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className={label}>Publishable key</span>
            <Input
              value={s.publishableKey}
              disabled={!canEdit}
              onChange={(e) => patch({ publishableKey: e.target.value })}
              placeholder="pk_test_…"
            />
          </label>

          <label className="block">
            <span className={label}>
              Secret key{" "}
              {s.hasSecretKey && (
                <span className="font-normal text-[color:var(--color-text-subtle)]">
                  — stored: {s.secretKeyMasked}
                </span>
              )}
            </span>
            <Input
              value={secretKey}
              disabled={!canEdit}
              onChange={(e) => setSecretKey(e.target.value)}
              type="password"
              autoComplete="off"
              placeholder={s.hasSecretKey ? "Leave blank to keep the stored key" : "sk_test_…"}
            />
          </label>

          <label className="block">
            <span className={label}>
              Webhook signing secret{" "}
              {s.hasWebhookSecret && (
                <span className="font-normal text-[color:var(--color-text-subtle)]">
                  — stored: {s.webhookSecretMasked}
                </span>
              )}
            </span>
            <Input
              value={webhookSecret}
              disabled={!canEdit}
              onChange={(e) => setWebhookSecret(e.target.value)}
              type="password"
              autoComplete="off"
              placeholder={s.hasWebhookSecret ? "Leave blank to keep the stored secret" : "whsec_…"}
            />
            <span className="mt-1 block text-[12px] leading-relaxed text-[color:var(--color-text-subtle)]">
              Add an endpoint in Stripe pointing at{" "}
              <code className="rounded bg-[color:var(--color-surface-muted)] px-1">
                /api/webhooks/stripe
              </code>{" "}
              for these events. Without this secret no donation is ever
              credited; without the dispute events a chargeback is never
              taken back off the member&apos;s balance.
            </span>
            <span className="mt-1.5 flex flex-wrap gap-1">
              {/* Read from the same list the handler switches on, so
                  the instructions cannot fall behind the code. */}
              {REQUIRED_STRIPE_EVENTS.map((e) => (
                <code
                  key={e}
                  className="rounded bg-[color:var(--color-surface-muted)] px-1.5 py-0.5 text-[11.5px]"
                >
                  {e}
                </code>
              ))}
            </span>
          </label>

          <div className="flex items-center gap-2 pt-1">
            <Button variant="secondary" loading={testing} onClick={() => void runTest()}>
              Test connection
            </Button>
            {test && (
              <span
                className={`text-[13px] ${
                  test.ok && !test.modeMismatch
                    ? "text-[color:var(--color-success-ink)]"
                    : test.ok
                      ? "text-[color:var(--color-warning-ink)]"
                      : "text-[color:var(--color-danger)]"
                }`}
              >
                {test.message}
              </span>
            )}
          </div>

          {test?.ok && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-[12px] bg-[color:var(--color-surface-muted)] p-3 text-[12.5px]">
              <dt className="text-[color:var(--color-text-subtle)]">Account</dt>
              <dd className="font-medium">{test.accountName}</dd>
              <dt className="text-[color:var(--color-text-subtle)]">Country</dt>
              <dd className="font-medium">{test.country ?? "—"}</dd>
              <dt className="text-[color:var(--color-text-subtle)]">Charges</dt>
              <dd className="font-medium">{test.chargesEnabled ? "Enabled" : "Not enabled"}</dd>
              <dt className="text-[color:var(--color-text-subtle)]">Key</dt>
              <dd className="font-medium">{test.livemode ? "Live" : "Test"}</dd>
            </dl>
          )}
        </div>
      </div>

      {/* ── donations ── */}
      <div className={section}>
        <h2 className="text-[15px] font-semibold">Donations</h2>

        <div className="mt-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[13.5px] font-medium">Accept donations</p>
              <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
                Off means no checkout and no withdrawal requests.
              </p>
            </div>
            <Switch
              checked={s.enabled}
              disabled={!canEdit}
              onChange={(v: boolean) => patch({ enabled: v })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={label}>Smallest donation ($)</span>
              <Input
                value={minDollars}
                disabled={!canEdit}
                inputMode="decimal"
                onChange={(e) => setMinDollars(e.target.value)}
              />
            </label>
            <label className="block">
              <span className={label}>Largest donation ($)</span>
              <Input
                value={maxDollars}
                disabled={!canEdit}
                inputMode="decimal"
                onChange={(e) => setMaxDollars(e.target.value)}
              />
            </label>
          </div>

          <div>
            <span className={label}>What the recipient is credited</span>
            <div className="space-y-2">
              {(
                [
                  {
                    v: "net" as const,
                    title: "The donation minus Stripe's fee",
                    hint: "On a $100 donation Stripe keeps about $3.20, so the member is credited about $96.80. WorldWeCare is never out of pocket.",
                  },
                  {
                    v: "gross" as const,
                    title: "The full donation",
                    hint: "The member is credited $100 and WorldWeCare absorbs Stripe's $3.20. A deliberate subsidy — the 1% payout fee does not cover it.",
                  },
                ]
              ).map((o) => (
                <label
                  key={o.v}
                  className={`flex cursor-pointer gap-3 rounded-[12px] border p-3 transition-colors ${
                    s.creditRecipient === o.v
                      ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-soft)]/40"
                      : "border-[color:var(--color-border)] hover:border-[color:var(--color-brand)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="creditRecipient"
                    disabled={!canEdit}
                    checked={s.creditRecipient === o.v}
                    onChange={() => patch({ creditRecipient: o.v })}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--color-brand)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-medium">{o.title}</span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-[color:var(--color-text-subtle)]">
                      {o.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      </div>

      {error && <p className="text-[13px] text-[color:var(--color-danger)]">{error}</p>}
      {flash && <p className="text-[13px] text-[color:var(--color-success-ink)]">{flash}</p>}

      {canEdit && (
        <div className="flex justify-end">
          <Button loading={saving} disabled={!encryptionReady} onClick={() => void save()}>
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
