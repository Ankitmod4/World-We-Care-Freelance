"use client";

/**
 * A member's donation history — what they gave, and what they received.
 *
 * Two tabs rather than one merged list: "I gave £20 to Sam" and "Sam
 * gave me £20" are different facts and merging them into one column of
 * amounts is how someone misreads their own finances.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
// The shape comes from the module that produces it. This used to be a
// hand-copied interface, and it had silently fallen a field behind:
// the API sends `causeTitle`, the copy never declared it, so every
// event donation rendered as the fallback "To WorldWeCare". A type
// this file cannot get wrong is worth more than one it can edit.
import type { DonationRow as Row } from "@/lib/donations";
import { formatCents } from "@/lib/money";
import { useT } from "./locale-context";
import { TRich } from "./t-rich";

interface Balance {
  availableCents: number;
  onHoldCents: number;
  reservedCents: number;
  paidOutCents: number;
  lifetimeCents: number;
}

const money = (cents: number, currency = "usd") => formatCents(cents, currency);
const when = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export function DonationHistory() {
  const t = useT();
  const [tab, setTab] = useState<"given" | "received">("given");
  const [given, setGiven] = useState<Row[] | null>(null);
  const [received, setReceived] = useState<Row[] | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/user/donations", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setGiven([]);
      setReceived([]);
      return;
    }
    const d = (await res.json()) as { given: Row[]; received: Row[]; balance: Balance };
    setGiven(d.given ?? []);
    setReceived(d.received ?? []);
    setBalance(d.balance ?? null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = tab === "given" ? given : received;
  // A disputed donation is money the platform no longer holds, so it
  // does not belong in a total either.
  const givenTotal = (given ?? [])
    .filter((r) => r.status !== "DISPUTED")
    .reduce((n, r) => n + r.grossCents - r.refundedCents, 0);

  const card =
    "rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card";

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("menu.donations", "Donations")}</h1>
        <p className="mt-0.5 text-[13.5px] text-[color:var(--color-text-muted)]">
          {t("donations.blurb", "What you\u2019ve given, and what people have given you.")}
        </p>
      </header>

      <div className="mb-5 flex gap-1">
        {(
          [
            { v: "given" as const, label: t("donations.given", "Given"), n: given?.length },
            { v: "received" as const, label: t("donations.received", "Received"), n: received?.length },
          ]
        ).map((t) => (
          <button
            key={t.v}
            type="button"
            onClick={() => setTab(t.v)}
            className={`h-9 rounded-full px-4 text-[13px] font-medium transition-colors ${
              tab === t.v
                ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
                : "border border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-brand)]"
            }`}
          >
            {t.label}
            {t.n ? ` ${t.n}` : ""}
          </button>
        ))}
      </div>

      {tab === "given" && given && given.length > 0 && (
        <p className="mb-4 text-[13.5px] text-[color:var(--color-text-muted)]">
          {/*
            One sentence with the amount inside it, not three
            fragments around a <strong>. Split, a translator gets
            "You've given", the number, and "in total. Thank you." —
            and no way to put the figure where their language wants
            it. Several put it first.
          */}
          <TRich
            text={t("donations.givenTotal", "You've given {amount} in total. Thank you.")}
            vars={{
              amount: (
                <strong className="text-[color:var(--color-text)]">{money(givenTotal)}</strong>
              ),
            }}
          />
        </p>
      )}

      {tab === "received" && balance && (
        <div className={`${card} mb-4 p-4`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-[color:var(--color-text-muted)]">
                {t("payouts.ready", "Ready to withdraw")}
              </p>
              <p className="text-[24px] font-semibold tabular-nums">
                {money(balance.availableCents)}
              </p>
              {balance.onHoldCents > 0 && (
                <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-subtle)]">
                  {money(balance.onHoldCents)} still clearing
                </p>
              )}
            </div>
            <Link
              href="/settings/payouts"
              className="inline-flex h-9 items-center rounded-full bg-[color:var(--color-brand)] px-4 text-[13px] font-semibold text-[color:var(--color-on-brand)] transition-colors hover:bg-[color:var(--color-brand-hover)]"
            >
              {t("payouts.withdraw", "Withdraw")}
            </Link>
          </div>
        </div>
      )}

      {rows === null ? (
        <p className="text-[13px] text-[color:var(--color-text-subtle)]">{t("common.loading", "Loading\u2026")}</p>
      ) : rows.length === 0 ? (
        <div className={`${card} p-10 text-center`}>
          <p className="text-[15px] font-medium">
            {tab === "given"
              ? t("donations.noneGiven", "You haven't donated yet")
              : t("donations.noneReceived", "Nothing received yet")}
          </p>
          <p className="mx-auto mt-1 max-w-[46ch] text-[13.5px] text-[color:var(--color-text-muted)]">
            {tab === "given"
              ? t(
                  "donations.noneGivenBlurb",
                  "Donations you make will be listed here with the date and amount.",
                )
              : t("donations.noneReceivedBlurb", "When someone donates to you it'll show up here.")}
          </p>
        </div>
      ) : (
        <div className={`${card} divide-y divide-[color:var(--color-border-soft)]`}>
          {rows.map((r) => {
            // A $5 refund on a $500 donation is not a reversal. Only
            // strike the amount through when the whole credit went
            // back; otherwise say how much did.
            const refunded = r.refundedCents > 0;
            const fullyRefunded = refunded && r.refundedCents >= r.netCents;
            const disputed = r.status === "DISPUTED";
            const pendingHold =
              tab === "received" && r.availableAt && new Date(r.availableAt) > new Date();
            return (
              <div key={r.id} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">
                    {tab === "given"
                      ? // The cause is what the donor chose and what
                        // they'll recognise a month later. The
                        // recipient's name is the fallback, and the
                        // platform's name only when there is neither.
                        t("donations.to", "To {name}", { name: r.causeTitle ?? r.recipientName ?? "WorldWeCare" })
                      : r.isAnonymous
                        ? t("donations.fromAnon", "From someone anonymous")
                        : `From ${r.donorName ?? "a supporter"}`}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[color:var(--color-text-subtle)]">
                    {when(r.createdAt)}
                    {/* On the received side the cause is the thing
                        that distinguishes one donation from another,
                        so it belongs on the row even though the name
                        leads. */}
                    {tab === "received" && r.causeTitle && ` · for ${r.causeTitle}`}
                    {tab === "given" && r.causeTitle && r.recipientName && ` · ${r.recipientName}`}
                    {fullyRefunded && " · refunded"}
                    {refunded &&
                      !fullyRefunded &&
                      " \u00b7 " +
                        t("donations.partlyRefunded", "{amount} refunded", {
                          amount: money(r.refundedCents, r.currency),
                        })}
                    {disputed && " · under review"}
                    {pendingHold && r.availableAt && ` · available ${when(r.availableAt)}`}
                  </p>
                  {r.message && (
                    <p className="mt-1.5 text-[13px] italic text-[color:var(--color-text-muted)]">
                      &ldquo;{r.message}&rdquo;
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-[15px] font-semibold tabular-nums ${
                      fullyRefunded || disputed
                        ? "text-[color:var(--color-text-subtle)] line-through"
                        : ""
                    }`}
                  >
                    {money(tab === "given" ? r.grossCents : r.netCents)}
                  </p>
                  {tab === "received" && r.netCents !== r.grossCents && !fullyRefunded && (
                    <p className="text-[11px] text-[color:var(--color-text-subtle)]">
                      of {money(r.grossCents)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
