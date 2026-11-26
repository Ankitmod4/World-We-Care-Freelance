"use client";

/**
 * The crisis / support card.
 *
 * LIVED IN THE RIGHT RAIL, NOW SHARED. The gratitude and confession
 * walls went full-width to make room for a picture wall, which hides
 * that rail — and the confession wall is the single page on this site
 * where this card matters most. Somebody writing at 3am is on that
 * page, not on the one with the sidebar. So it moved out here and both
 * walls render it inline above the grid.
 *
 * `compact` is for the gratitude wall. The full card at the top of a
 * page whose entire job is "say what went well today" changes the tone
 * of it, but removing it entirely would leave one page with no route
 * to help at all. One line and the number is the honest middle.
 */

import type { ReactNode } from "react";
import { useT } from "./locale-context";
import { useCountry } from "./country-context";
import type { TFunction } from "@/lib/i18n-core";

/**
 * THE COUNTRY COMES FROM CONTEXT, NOT A PROP.
 *
 * Seven callers passed `country?.name ?? null`, read from the very
 * context this component can read itself — seven copies of one line,
 * and seven chances for one of them to drift. It reads it directly
 * now, and the callers say `<SupportCard />`.
 *
 * It needs the CODE, not the name. The decision below — whether to
 * offer the US lifeline or say local lines are coming — used to be
 * `countryName !== "United States"`, a test against an English
 * display string. That was already fragile; once country names are
 * localised it is simply wrong, and wrong in the worst place on the
 * site: a member in the US reading in Russian would be told their
 * local crisis lines do not exist yet, beside a number that is
 * theirs. A country is identified by its ISO code.
 */
export function SupportCard({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const { country } = useCountry();
  if (compact) {
    return (
      <aside className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[12px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] px-3.5 py-2.5 text-[12.5px]">
        <span className="font-medium text-[color:var(--color-text)]">
          {t("support.compactLine", "If today is heavy, you don't have to carry it by yourself.")}
        </span>
        <span className="text-[color:var(--color-text-muted)]">
          {t("support.compactLifeline", "US · call or text {number} — free, confidential, 24/7.", {
            number: "988",
          })}
        </span>
      </aside>
    );
  }

  return renderFull(t, country?.name ?? null, country?.code ?? null);
}

function renderFull(
  t: TFunction,
  countryName: string | null,
  countryCode: string | null,
): ReactNode {
  return (
    <section className="overflow-hidden rounded-[16px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-[var(--shadow-card)]">
      <div className="border-l-[3px] border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] px-4 py-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-brand-ink)]">
          {t("crisis.title", "You're not alone")}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--color-text)]">
          {t(
            "support.courage",
            "Reaching out takes courage. If today is heavy, you don't have to carry it by yourself.",
          )}
        </p>
      </div>
      <div className="px-4 py-3 space-y-2.5">
        <p className="text-[12.5px] leading-relaxed text-[color:var(--color-text-muted)]">
          {t(
            "support.emergency",
            "If you're in immediate danger, call your local emergency number right away.",
          )}
        </p>
        <div className="rounded-[10px] bg-[color:var(--color-surface-muted)] px-3 py-2.5">
          <p className="text-[12px] font-semibold text-[color:var(--color-text)]">
            {t("crisis.lifelineName", "US · {number} Suicide & Crisis Lifeline", {
              number: "988",
            })}
          </p>
          <p className="text-[11.5px] text-[color:var(--color-text-subtle)] mt-0.5">
            {t("crisis.lifelineHow", "Call or text {number} — free, confidential, 24/7.", {
              number: "988",
            })}
          </p>
        </div>
        <p className="text-[11px] leading-relaxed text-[color:var(--color-text-subtle)]">
          {countryName && countryCode !== "US"
            ? t("support.localSoon", "Local {country} crisis lines are coming soon.", {
                country: countryName,
              }) + " "
            : ""}
          {t("support.peerSoon", "Peer-support chatrooms with trained responders are on the way.")}
        </p>
      </div>
    </section>
  );
}
