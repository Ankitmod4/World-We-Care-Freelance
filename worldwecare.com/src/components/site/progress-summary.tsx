"use client";

/**
 * The progress block that sits on a profile.
 *
 * "The streak count sits on the profile — visible to the user always,
 * and to others only if the user wants." — plan.docx §4. This is that
 * sentence, and the `readOnly` flag is the "only if the user wants"
 * half: on somebody else's profile the caller has already filtered to
 * what is public, so this component never decides visibility itself.
 * It renders what it is handed.
 *
 * ONE CARD, TWO ROWS — a stat row and a milestone strip.
 *
 * It used to be three loose blocks stacked under a heading: a grid of
 * streak cards, a sentence about the journal, then a wrapped row of
 * full-width milestone pills that ran to two or three lines and ended
 * in "12 more to find". Wrapped pills of uneven width read as
 * scattered; a strip of even chips reads as a set, which is the whole
 * point of a trophy case. Same call DazzlingDish's makes.
 *
 * Kept deliberately small. The place to manage streaks is /progress;
 * this is the glance, not the workshop.
 */

import Link from "next/link";
import type { StreakView } from "@/lib/streaks";
import { streakName, streakUnit } from "@/lib/streak-text";
import type { BadgeDef } from "@/lib/badges";
import { MilestoneChip, StatTile } from "./milestone-chip";
import { useT } from "./locale-context";
import { badgeText } from "@/lib/badge-text";

export type ProfileBadge = BadgeDef & { earnedAt: string | null };

/** How many chips before the rest become "+N more". Two rows at most. */
const STRIP = 8;

export function ProgressSummary({
  streaks,
  badges,
  journalDays,
  readOnly,
  /** Whose it is, for the empty state's wording. */
  who,
}: {
  streaks: StreakView[];
  badges: ProfileBadge[];
  journalDays?: number;
  readOnly?: boolean;
  who?: string;
}) {
  const t = useT();
  const earned = badges.filter((b) => b.earnedAt);
  const live = streaks.filter((s) => !s.archived);

  // On someone else's profile, nothing to show means show nothing —
  // an empty "no streaks" card on a stranger's page is noise, and it
  // also quietly announces that they have progress turned off.
  if (readOnly && live.length === 0 && earned.length === 0) return null;

  const nothingYet = live.length === 0 && earned.length === 0;

  return (
    <section className="mt-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
          {readOnly
            ? t("progress.theirProgress", "{who} progress", {
                who: who ?? t("progress.their", "Their"),
              })
            : t("progress.title", "Your progress")}
        </h2>
        {!readOnly && (
          <Link
            href="/progress"
            className="text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline"
          >
            {t("progress.manage", "Manage")}
          </Link>
        )}
      </div>

      {nothingYet ? (
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-6 text-center shadow-card">
          <p className="text-[14px] font-medium">{t("progress.empty", "Nothing counted yet")}</p>
          <p className="mx-auto mt-1 max-w-[44ch] text-[13px] text-[color:var(--color-text-muted)]">
            {t(
              "progress.summaryEmptyBlurb",
              "A streak counts from a date you pick, so you can start one for something you began months ago.",
            )}
          </p>
          <Link
            href="/progress"
            className="mt-3 inline-flex h-9 items-center rounded-full bg-[color:var(--color-brand)] px-3.5 text-[13px] font-semibold text-[color:var(--color-on-brand)]"
          >
            {t("progress.trackSomething", "Track something")}
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
          {live.length > 0 && (
            <ul className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
              {live.map((s) => (
                <li key={s.id}>
                  <StatTile
                    label={`${s.emoji} ${streakName(t, s.kind, s.label)}`}
                    value={s.days}
                    // Only on your own profile: a "hidden" pill on a
                    // public page would be a hole where a number is,
                    // which tells a reader more than showing it.
                    hint={
                      streakUnit(t, s.kind) +
                      (!readOnly && !s.isPublic ? ` · ${t("progress.onlyYou", "only you")}` : "")
                    }
                  />
                </li>
              ))}
              {!readOnly && journalDays !== undefined && journalDays > 0 && (
                <li>
                  <StatTile
                    label={"📓 " + t("rail.journal", "Journal")}
                    value={journalDays}
                    hint={t("progress.daysRunning", "days running")}
                  />
                </li>
              )}
            </ul>
          )}

          {earned.length > 0 && (
            <div
              className={
                "flex flex-wrap items-center gap-1.5 px-3 pb-3 " +
                // Only a rule when there is something above it to
                // divide from.
                (live.length > 0
                  ? "border-t border-[color:var(--color-border-soft)] pt-3"
                  : "pt-3")
              }
            >
              <span className="mr-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)]">
                {t("progress.milestones", "Milestones")}
              </span>
              {earned.slice(0, STRIP).map((b) => (
                <MilestoneChip
                  key={b.slug}
                  emoji={b.emoji}
                  name={badgeText(t, b).name}
                  description={badgeText(t, b).description}
                  earned
                  size="sm"
                />
              ))}
              {/*
                One trailing link, not a chip per unearned milestone.
                It counts what is LEFT rather than what is hidden,
                because "12 more to find" is an invitation and
                "+12 more" is a truncation notice.
              */}
              {!readOnly && (
                <Link
                  href="/progress"
                  className="text-[11.5px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)]"
                >
                  {badges.length > earned.length
                    ? t("progress.moreToFind", "{n} more to find \u2192", {
                        n: badges.length - earned.length,
                      })
                    : t("progress.allOfThem", "All of them \u2192")}
                </Link>
              )}
              {readOnly && earned.length > STRIP && (
                <span className="text-[11.5px] text-[color:var(--color-text-subtle)]">
                  +{earned.length - STRIP} more
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
