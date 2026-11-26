"use client";

/**
 * Shared tier metadata + badge for chatrooms.
 *
 * THE COLOURS STAY IN THE TABLE, THE WORDS MOVED OUT. `TIER_META` is
 * still the single place that says Crisis is red — a class name is not
 * a sentence and has nothing to translate. The label and hint ARE
 * sentences, so they live in `tierText()` as literal `t()` calls where
 * `scripts/extract-strings.ts` can see them; `t(TIER_META[x].label)`
 * would be invisible to it and the tiers would never get translated.
 */

import type { TFunction } from "@/lib/i18n-core";
import { useT } from "./locale-context";

export type Tier = "PUBLIC" | "SUPPORT" | "CRISIS" | "CAVALRY";

export function tierText(t: TFunction): Record<Tier, { label: string; hint: string }> {
  return {
    PUBLIC: {
      label: t("tier.public", "Public"),
      hint: t("tier.publicHint", "Anyone can read and post."),
    },
    SUPPORT: {
      label: t("tier.support", "Support"),
      hint: t("tier.supportHint", "Join to post; your first message is reviewed."),
    },
    CRISIS: {
      label: t("tier.crisis", "Crisis"),
      hint: t("tier.crisisHint", "Trained responders. Panic button coming soon."),
    },
    CAVALRY: {
      label: t("tier.cavalry", "Cavalry"),
      hint: t("tier.cavalryHint", "Verified members, real-world action."),
    },
  };
}

export const TIER_META: Record<Tier, { text: string; bg: string; dot: string }> = {
  PUBLIC: {
    text: "text-[color:var(--color-brand-ink)]",
    bg: "bg-[color:var(--color-brand-tint)]",
    dot: "var(--color-brand)",
  },
  SUPPORT: {
    text: "text-[color:var(--color-success-ink)]",
    bg: "bg-[color:var(--color-success-soft)]",
    dot: "var(--color-success)",
  },
  CRISIS: {
    text: "text-[color:var(--color-danger-ink)]",
    bg: "bg-[color:var(--color-danger-soft)]",
    dot: "var(--color-danger)",
  },
  CAVALRY: {
    text: "text-[color:var(--color-accent-ink)]",
    bg: "bg-[color:var(--color-accent-soft)]",
    dot: "var(--color-accent)",
  },
};

export function TierBadge({ tier }: { tier: Tier }) {
  const t = useT();
  const m = TIER_META[tier];
  const words = tierText(t)[tier];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-full ${m.bg} ${m.text}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.dot }} />
      {words.label}
    </span>
  );
}
