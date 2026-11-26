/**
 * The words a streak wears — split out of `streaks.ts` so a client
 * component can read them without dragging Prisma into the browser
 * bundle, and so every one of them goes through `t()`.
 *
 * TWO FLAVOURS OF `describeDays`. `describeDays` stays English: the
 * digest email is composed on a schedule, for a mailbox, not inside a
 * request that knows which language the reader picked. `describeDaysT`
 * is the one the site uses. When the digest learns about locales it
 * switches to the second and this comment goes away.
 *
 * A CUSTOM STREAK IS NOT TRANSLATED. Whatever somebody typed in as
 * their own label is their words; machine-rewriting it would be the
 * same mistake as translating a username.
 */

import type { TFunction } from "./i18n-core";

export type StreakKindName =
  | "SOBER"
  | "MEDITATION"
  | "VOLUNTEERING"
  | "JOURNALING"
  | "CUSTOM";

/** How each kind describes itself when the member has not renamed it. */
export const STREAK_LABELS: Record<
  StreakKindName,
  { name: string; unit: string; emoji: string }
> = {
  SOBER: { name: "Sober", unit: "days sober", emoji: "\u{1F331}" },
  MEDITATION: { name: "Meditation", unit: "days meditating", emoji: "\u{1F56F}\u{FE0F}" },
  VOLUNTEERING: { name: "Volunteering", unit: "days volunteering", emoji: "\u{1F91D}" },
  JOURNALING: { name: "Journaling", unit: "days journaling", emoji: "\u{1F4D3}" },
  CUSTOM: { name: "Something else", unit: "days", emoji: "\u{2B50}" },
};

/** The built-in name for a kind, in the reader's language. */
export function streakKindName(t: TFunction, kind: StreakKindName): string {
  switch (kind) {
    case "SOBER":
      return t("streak.kind.sober", "Sober");
    case "MEDITATION":
      return t("streak.kind.meditation", "Meditation");
    case "VOLUNTEERING":
      return t("streak.kind.volunteering", "Volunteering");
    case "JOURNALING":
      return t("streak.kind.journaling", "Journaling");
    default:
      return t("streak.kind.custom", "Something else");
  }
}

/** "days sober", "days meditating" — the unit under the big number. */
export function streakUnit(t: TFunction, kind: StreakKindName): string {
  switch (kind) {
    case "SOBER":
      return t("streak.unit.sober", "days sober");
    case "MEDITATION":
      return t("streak.unit.meditation", "days meditating");
    case "VOLUNTEERING":
      return t("streak.unit.volunteering", "days volunteering");
    case "JOURNALING":
      return t("streak.unit.journaling", "days journaling");
    default:
      return t("streak.unit.custom", "days");
  }
}

/**
 * The name to show for one streak: the member's own label if they
 * wrote one, otherwise the translated built-in.
 */
export function streakName(
  t: TFunction,
  kind: StreakKindName,
  label?: string | null,
): string {
  const own = label?.trim();
  if (own) return own;
  return streakKindName(t, kind);
}

/** "3 days", "1 day", "8 months", "2 years" — English, for email. */
export function describeDays(days: number): string {
  if (days <= 0) return "starting today";
  if (days === 1) return "1 day";
  if (days < 60) return `${days} days`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months} months`;
  return `${Math.floor(days / 365)} years`;
}

/** The same phrase, in the reader's language. */
export function describeDaysT(t: TFunction, days: number): string {
  if (days <= 0) return t("streak.startingToday", "starting today");
  if (days === 1) return t("streak.oneDay", "1 day");
  if (days < 60) return t("streak.nDays", "{n} days", { n: days });
  const months = Math.floor(days / 30);
  if (months < 24) return t("streak.nMonths", "{n} months", { n: months });
  return t("streak.nYears", "{n} years", { n: Math.floor(days / 365) });
}
