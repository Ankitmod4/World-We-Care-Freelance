"use client";

/**
 * The donate control: a button, and the modal it opens.
 *
 * Follows the same shape as the other site modals (report-place,
 * submit-event) — a bottom sheet on a phone, a centred dialog from
 * `sm` up. That split matters more here than elsewhere: this form has
 * a keyboard-summoning input near the bottom, and a centred box on a
 * short screen puts the Donate button underneath the keyboard.
 *
 * Card details never touch this app. The modal collects an amount and
 * a message, then hands off to Stripe Checkout, which is the whole
 * reason for a redirect rather than an embedded card field.
 *
 * Renders NOTHING when donations are off or Stripe isn't connected. A
 * dead button that explains itself on click advertises a feature that
 * isn't there.
 */

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents, parseAmountToCents } from "@/lib/money";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";

const PRESETS = [500, 1000, 2500, 5000];

const money = (cents: number, currency = "usd") => formatCents(cents, currency);

interface Config {
  enabled: boolean;
  minCents: number;
  maxCents: number;
  /** Drives the symbol. The API has always sent it; nothing read it. */
  currency: string;
}

export function DonateButton({
  eventId,
  campaignId,
  liveStreamId,
  recipientUserId,
  causeLabel,
  signedIn,
  className,
}: {
  eventId?: string;
  campaignId?: string;
  /** A broadcast credits whoever is on air; the server resolves it. */
  liveStreamId?: string;
  recipientUserId?: string;
  causeLabel?: string;
  signedIn: boolean;
  className?: string;
}) {
  const t = useT();
  const [config, setConfig] = useState<Config | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetch("/api/public/donations/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d: Partial<Config>) => {
        if (alive) {
          setConfig({
            enabled: !!d.enabled,
            minCents: d.minCents ?? 100,
            maxCents: d.maxCents ?? 500_000,
            currency: d.currency ?? "usd",
          });
        }
      })
      .catch(() => { if (alive) setConfig({ enabled: false, minCents: 100, maxCents: 500_000, currency: "usd" }); });
    return () => { alive = false; };
  }, []);

  if (!config?.enabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-[color:var(--color-accent)] px-4 text-[13.5px] font-semibold text-[color:var(--color-on-accent)] transition-opacity hover:opacity-90 sm:w-auto"
        }
      >
        <HeartIcon />
        {t("donate.button", "Donate")}
      </button>

      <DonateModal
        open={open}
        onClose={() => setOpen(false)}
        config={config}
        eventId={eventId}
        campaignId={campaignId}
        liveStreamId={liveStreamId}
        recipientUserId={recipientUserId}
        causeLabel={causeLabel}
        signedIn={signedIn}
      />
    </>
  );
}

function HeartIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.8 8.6a5 5 0 00-8.8-2.6 5 5 0 00-8.8 2.6c0 5 8.8 10.4 8.8 10.4s8.8-5.4 8.8-10.4z" />
    </svg>
  );
}

function DonateModal({
  open,
  onClose,
  config,
  eventId,
  campaignId,
  liveStreamId,
  recipientUserId,
  causeLabel,
  signedIn,
}: {
  open: boolean;
  onClose: () => void;
  config: Config;
  eventId?: string;
  campaignId?: string;
  liveStreamId?: string;
  recipientUserId?: string;
  causeLabel?: string;
  signedIn: boolean;
}) {
  const t = useT();
  const [amountCents, setAmountCents] = useState(1000);
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");
  const [anon, setAnon] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Fresh every time it opens: a half-filled form from a previous
  // change of mind is not what someone wants to come back to.
  useEffect(() => {
    if (!open) return;
    setAmountCents(1000);
    setCustom("");
    setMessage("");
    setAnon(false);
    setEmail("");
    setError(null);
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // Lock the page behind the sheet. Without this a phone scrolls the
    // event page under the modal as soon as the form is longer than
    // the screen, which feels broken.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus in, so a keyboard or screen reader lands inside the
    // dialog rather than continuing down the page behind it.
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  // parseAmountToCents REFUSES ambiguous input rather than guessing.
  // "10,50" is ten euros fifty across most of Europe and one thousand
  // and fifty to anything that strips the comma — so it returns null
  // and the donor is asked, instead of being charged 100x.
  const typed = custom.trim();
  const parsed = typed ? parseAmountToCents(typed) : amountCents;
  const unreadable = typed !== "" && parsed === null;
  const chosen = parsed ?? 0;
  const tooSmall = !unreadable && chosen > 0 && chosen < config.minCents;
  const tooBig = !unreadable && chosen > config.maxCents;
  const valid = !unreadable && !tooSmall && !tooBig && chosen >= config.minCents;

  const go = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/user/donations/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountCents: chosen,
        eventId,
        campaignId,
        liveStreamId,
        recipientUserId,
        message: message.trim() || undefined,
        isAnonymous: anon,
        donorEmail: signedIn ? undefined : email.trim() || undefined,
      }),
    }).catch(() => null);

    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(serverText(t, d?.error) || t("donate.startFailed", "Couldn't start that donation."));
      setBusy(false);
      return;
    }
    const d = (await res.json()) as { url?: string };
    if (!d.url) {
      setError(t("donate.noCheckout", "Stripe didn't return a checkout page."));
      setBusy(false);
      return;
    }
    // Leaving the app entirely, so a full navigation rather than a
    // router push. Deliberately not clearing `busy` — the button stays
    // disabled through the redirect so it can't be pressed twice.
    window.location.href = d.url;
  };

  const label = "mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={
          causeLabel
            ? t("donate.ariaTo", "Donate to {cause}", { cause: causeLabel })
            : t("donate.button", "Donate")
        }
        tabIndex={-1}
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-[color:var(--color-surface)] shadow-elevated outline-none sm:max-h-[88vh] sm:rounded-2xl"
      >
        {/* ── header ── */}
        <header className="flex items-start justify-between gap-3 border-b border-[color:var(--color-border-soft)] px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{t("donate.button", "Donate")}</h2>
            {causeLabel && (
              <p className="mt-0.5 truncate text-[12.5px] text-[color:var(--color-text-muted)]">
                {causeLabel}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close", "Close")}
            className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-muted)]"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* ── body: the only part that scrolls ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <fieldset>
            <legend className={label}>{t("donate.howMuch", "How much?")}</legend>
            {/* Two across on a phone so the targets stay thumb-sized,
                four across once there's room. */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRESETS.map((p) => {
                const on = !custom.trim() && amountCents === p;
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={on}
                    onClick={() => { setAmountCents(p); setCustom(""); }}
                    className={`h-11 rounded-[12px] text-[14px] font-semibold transition-colors ${
                      on
                        ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
                        : "border border-[color:var(--color-border)] text-[color:var(--color-text)] hover:border-[color:var(--color-brand)]"
                    }`}
                  >
                    {money(p, config.currency)}
                  </button>
                );
              })}
            </div>
            <label className="mt-2 block">
              <span className="sr-only">{t("donate.otherAmount", "Another amount")}</span>
              <Input
                value={custom}
                inputMode="decimal"
                placeholder={t("donate.otherAmount", "Another amount")}
                onChange={(e) => setCustom(e.target.value)}
              />
            </label>
          </fieldset>

          {!signedIn && (
            <label className="mt-4 block">
              <span className={label}>{t("donate.emailForReceipt", "Your email \u2014 for the receipt")}</span>
              <Input value={email} type="email" inputMode="email" onChange={(e) => setEmail(e.target.value)} />
            </label>
          )}

          <label className="mt-4 block">
            <span className={label}>
              {t("donate.message", "Message")}{" "}
              <span className="font-normal text-[color:var(--color-text-subtle)]">
                {t("donate.optional", "— optional")}
              </span>
            </span>
            <Input
              value={message}
              maxLength={500}
              placeholder={t("donate.messagePlaceholder", "Say something to the organiser")}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>

          {signedIn && (
            <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2.5 text-[13.5px]">
              <input
                type="checkbox"
                checked={anon}
                onChange={(e) => setAnon(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-[color:var(--color-brand)]"
              />
              {t("donate.anon", "Give without showing my name")}
            </label>
          )}

          <p className="mt-4 text-[12px] leading-relaxed text-[color:var(--color-text-subtle)]">
            {t("donate.stripeNote", "You'll pay through Stripe. Card details never touch this site.")}
          </p>
        </div>

        {/* ── footer: pinned, so the action is reachable on a short
             screen without scrolling the form to the bottom ── */}
        <div className="border-t border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] px-4 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          {error && <p className="mb-2 text-[12.5px] text-[color:var(--color-danger)]">{error}</p>}
          {unreadable && (
            <p className="mb-2 text-[12.5px] text-[color:var(--color-danger)]">
              {t("donate.badAmount", "Enter an amount like 25 or 25.50.")}
            </p>
          )}
          {tooSmall && (
            <p className="mb-2 text-[12.5px] text-[color:var(--color-text-subtle)]">
              {t("donate.tooSmall", "The smallest donation is {amount}.", {
                amount: money(config.minCents, config.currency),
              })}
            </p>
          )}
          {tooBig && (
            <p className="mb-2 text-[12.5px] text-[color:var(--color-text-subtle)]">
              {t("donate.tooBig", "The largest single donation is {amount}.", {
                amount: money(config.maxCents, config.currency),
              })}
            </p>
          )}
          <Button
            loading={busy}
            disabled={!valid}
            onClick={() => void go()}
            className="w-full"
          >
            {valid
              ? t("donate.giveAmount", "Donate {amount}", {
                  amount: money(chosen, config.currency),
                })
              : t("donate.button", "Donate")}
          </Button>
        </div>
      </div>
    </div>
  );
}
