"use client";

/**
 * /progress — streaks and milestones.
 *
 * WHAT THE REDESIGN FIXED. The first version was two stacked lists
 * with a section heading over each, and it read as an inventory: four
 * badge groups, each its own heading, each a sparse row of big cards,
 * so nine milestones filled a screen and a half and the streaks —
 * the part somebody actually opens this page for — scrolled away
 * first. It also ended on a settings checkbox, which is a strange last
 * word for a page about somebody's recovery.
 *
 * The shape now: ONE headline number, then the counters, then the
 * milestones as a single dense grid under a progress bar. Streaks
 * come first and stay on screen; milestones are scannable at a glance
 * rather than four lists to read.
 *
 * TONE IS STILL THE POINT. Nothing congratulates a number, nothing
 * warns about losing one, nothing is red, and resetting is called
 * "start again". The banked best is always shown beside it, because
 * the thing that makes that button pressable is knowing the days you
 * already did do not vanish when you press it.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StreakView } from "@/lib/streaks";
import {
  STREAK_LABELS,
  describeDaysT,
  streakKindName,
  streakName,
  streakUnit,
} from "@/lib/streak-text";
import type { BadgeDef } from "@/lib/badges";
import { MilestoneChip, StatTile } from "./milestone-chip";
import { useT } from "./locale-context";
import { serverText, type TFunction } from "@/lib/i18n-core";
import { badgeText } from "@/lib/badge-text";

type BadgeRow = BadgeDef & { earnedAt: string | null };

const KINDS = ["SOBER", "MEDITATION", "VOLUNTEERING", "JOURNALING", "CUSTOM"] as const;
/**
 * The badge groups, declared as literal calls so the extractor can see
 * them — a `t(GROUP_LABEL[b.group])` would be invisible to it. Same
 * pattern as header-nav.
 */
function groupLabels(t: TFunction): Record<BadgeDef["group"], string> {
  return {
    recovery: t("progress.groupRecovery", "Recovery"),
    writing: t("progress.groupWriting", "Writing"),
    community: t("progress.groupCommunity", "Community"),
    action: t("progress.groupAction", "Action"),
  };
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * The one control standing between a sobriety count and every member
 * of the site, so it names the STATE it is in rather than the action
 * it performs — "Private", not "Hide". A label describing the action
 * leaves you reading the button to work out where you stand.
 */
function VisibilityPill({
  streak,
  onToggle,
}: {
  streak: StreakView;
  onToggle: (s: StreakView, body: Record<string, unknown>) => void | Promise<void>;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => void onToggle(streak, { isPublic: !streak.isPublic })}
      aria-pressed={streak.isPublic}
      title={
        streak.isPublic
          ? t("progress.publicHint", "Anyone can see this on your profile — click to make it private")
          : t("progress.privateHint", "Only you can see this — click to show it on your profile")
      }
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors ${
        streak.isPublic
          ? "bg-[color:var(--color-brand)]/10 text-[color:var(--color-brand)]"
          : "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-subtle)]"
      }`}
    >
      {streak.isPublic ? t("progress.public", "Public") : t("progress.private", "Private")}
    </button>
  );
}

export function ProgressClient({ viewer }: { viewer: ShellViewer }) {
  const t = useT();
  const groups = groupLabels(t);
  const [streaks, setStreaks] = useState<StreakView[] | null>(null);
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [journalDays, setJournalDays] = useState(0);

  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]>("SOBER");
  const [label, setLabel] = useState("");
  const [startedOn, setStartedOn] = useState(today());
  /**
   * Ticked to start with, because that is the default the server
   * applies — and shown, because a default somebody can see and
   * untick is a default, while one they discover afterwards on their
   * own profile is a leak. Two clicks from here to a private streak;
   * zero surprises either way.
   */
  const [makePublic, setMakePublic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState<StreakView | null>(null);
  const [resetDate, setResetDate] = useState(today());

  const load = useCallback(async () => {
    const res = await fetch("/api/user/progress", { cache: "no-store" }).catch(() => null);
    const d = (await res?.json().catch(() => ({}))) as {
      streaks?: StreakView[];
      badges?: BadgeRow[];
      journalDays?: number;
    };
    setStreaks(d?.streaks ?? []);
    setBadges(d?.badges ?? []);
    setJournalDays(d?.journalDays ?? 0);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const live = useMemo(() => (streaks ?? []).filter((s) => !s.archived), [streaks]);
  /** The longest run — the number this page leads with. */
  const headline = useMemo(
    () => live.reduce<StreakView | null>((best, s) => (!best || s.days > best.days ? s : best), null),
    [live],
  );
  const others = useMemo(
    () => live.filter((s) => s.id !== headline?.id),
    [live, headline],
  );
  const earned = badges.filter((b) => b.earnedAt);

  /**
   * Earned first, then the registry's own order within each half.
   *
   * BADGES is grouped by theme, which is the right order for a
   * catalogue and the wrong one for a person: it scatters the three
   * somebody has earned among the twelve they have not, so the top of
   * the list is whatever theme happens to come first rather than
   * what they did. A stable sort keeps the themes intact inside each
   * half.
   */
  const ordered = useMemo(
    () =>
      [...badges].sort((a, b) => Number(!!b.earnedAt) - Number(!!a.earnedAt)),
    [badges],
  );

  const start = async () => {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/user/streaks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, startedOn, label: label || null, isPublic: makePublic }),
    }).catch(() => null);
    const d = (await res?.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res?.ok) {
      setError(serverText(t, d?.error) || t("progress.startFailed", "Couldn't start that."));
      return;
    }
    setAdding(false);
    setLabel("");
    setStartedOn(today());
    setMakePublic(true);
    void load();
  };

  const patch = async (s: StreakView, body: Record<string, unknown>) => {
    await fetch(`/api/user/streaks/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    void load();
  };

  const doReset = async () => {
    if (!resetting) return;
    setBusy(true);
    await patch(resetting, { reset: true, startedOn: resetDate });
    setBusy(false);
    setResetting(null);
  };

  return (
    <SiteShell viewer={viewer}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("progress.title", "Your progress")}</h1>
          <p className="mt-0.5 max-w-[62ch] text-[13.5px] text-[color:var(--color-text-muted)]">
            {t(
              "progress.subtitle",
              "Small wins matter. Milestones and new streaks show on your profile — every streak has its own Public/Private tick, so you can show one and keep another to yourself.",
            )}
          </p>
        </div>
        {!adding && live.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            {t("progress.trackSomething", "Track something")}
          </Button>
        )}
      </header>

      {/*
        The headline. One number, large, with everything else as
        context around it — rather than the old page's grid of equal
        cards where the streak somebody came to see looked exactly like
        the one they set up as an experiment.
      */}
      {streaks !== null && (
        <section className="mb-4 overflow-hidden rounded-[20px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
          {headline ? (
            <div className="flex flex-col gap-5 p-5 sm:p-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] text-[color:var(--color-text-muted)]">
                    {headline.emoji} {streakName(t, headline.kind, headline.label)}
                  </p>
                  <VisibilityPill streak={headline} onToggle={patch} />
                </div>
                <p className="mt-1 text-[52px] font-semibold leading-[0.95] tracking-[-0.03em] tabular-nums">
                  {headline.days}
                </p>
                <p className="mt-1.5 text-[13.5px] text-[color:var(--color-text-muted)]">
                  {t("progress.headlineLine", "{unit} — that's {described}, since {date}", {
                    unit: streakUnit(t, headline.kind),
                    described: describeDaysT(t, headline.days),
                    date: headline.startedOn,
                  })}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
                  <span className="text-[color:var(--color-text-subtle)]">
                    {headline.bestDays > headline.days
                      ? t("progress.bestSoFar", "Best so far: {n} days", { n: headline.bestDays })
                      : t("progress.longestYet", "Your longest yet")}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setResetting(headline);
                      setResetDate(today());
                    }}
                    className="font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:underline"
                  >
                    {t("progress.startAgain", "Start again")}
                  </button>
                </div>
              </div>

              {/*
                THE THREE NUMBERS, as a row of tiles rather than a
                right-aligned <dl>. Two right-aligned figures beside a
                52px headline made a second focal point competing with
                the first, and on a phone they wrapped underneath
                anyway looking like an orphaned caption. A tile row
                sits UNDER the headline at every width and reads as
                context to it — the shape DazzlingDish's hero uses.
              */}
              <dl className="grid w-full grid-cols-3 gap-2">
                <div>
                  <StatTile
                    label={t("progress.milestones", "Milestones")}
                    value={earned.length}
                    hint={t("progress.ofN", "of {n}", { n: badges.length })}
                  />
                </div>
                <div>
                  <StatTile
                    label={t("progress.best", "Best")}
                    value={Math.max(headline.bestDays, headline.days)}
                    hint={t("rail.days", "days")}
                  />
                </div>
                <div>
                  <StatTile
                    label={t("rail.journal", "Journal")}
                    value={journalDays}
                    hint={journalDays === 1 ? t("rail.day", "day") : t("rail.days", "days")}
                  />
                </div>
              </dl>
            </div>
          ) : (
            <div className="p-8 text-center sm:p-10">
              <p className="text-[16px] font-medium">{t("progress.empty", "Nothing counted yet")}</p>
              <p className="mx-auto mt-1 max-w-[48ch] text-[13.5px] leading-relaxed text-[color:var(--color-text-muted)]">
                {t(
                  "progress.emptyBlurb",
                  "A streak counts from a date you pick, so you can start one for something you began months ago. Nothing here resets on its own, and nobody sees it unless you say so.",
                )}
              </p>
              {!adding && (
                <Button size="sm" className="mt-4" onClick={() => setAdding(true)}>
                  {t("progress.trackSomething", "Track something")}
                </Button>
              )}
            </div>
          )}
        </section>
      )}

      {adding && (
        <div className="mb-4 rounded-[20px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-5 shadow-card">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
                {t("progress.whatKind", "What are you counting?")}
              </span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}
                className="h-11 w-full rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[14px] outline-none focus:border-[color:var(--color-brand)]"
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {STREAK_LABELS[k].emoji} {streakKindName(t, k)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
                {t("progress.sinceWhen", "Since when?")}
              </span>
              <Input
                type="date"
                value={startedOn}
                max={today()}
                onChange={(e) => setStartedOn(e.target.value)}
              />
              <span className="mt-1 block text-[11.5px] text-[color:var(--color-text-subtle)]">
                {t("progress.backdate", "Backdate it. If you started in March, say March.")}
              </span>
            </label>
          </div>
          {kind === "CUSTOM" && (
            <label className="mt-3 block">
              <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
                {t("progress.customLabel", "Call it what you'd call it")}
              </span>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
            </label>
          )}
          <label className="mt-3 flex cursor-pointer select-none items-start gap-2.5">
            <input
              type="checkbox"
              checked={makePublic}
              onChange={(e) => setMakePublic(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--color-brand)]"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">
                {t("progress.showOnProfile", "Show this on my profile")}
              </span>
              {/*
                The consequence, not the setting. "Public" is a word
                somebody skims; "anyone who visits your profile can see
                the number" is the thing they would want to have been
                told, and it costs one line.
              */}
              <span className="mt-0.5 block text-[11.5px] leading-snug text-[color:var(--color-text-subtle)]">
                {makePublic
                  ? t(
                      "progress.willBePublic",
                      "Anyone who visits your profile can see this count. You can turn it off any time.",
                    )
                  : t("progress.willBePrivate", "Only you will see this count.")}
              </span>
            </span>
          </label>
          {error && <p className="mt-2 text-[12.5px] text-[color:var(--color-danger)]">{error}</p>}
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={start} loading={busy}>
              {t("progress.startCounting", "Start counting")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* ── the counters ────────────────────────────────────── */}
      {/*
        The others. The headline streak is deliberately absent — it is
        the card above, with its own toggle and its own "start again",
        and printing it twice made the page look like it had double the
        streaks it has.
      */}
      {others.length > 0 && (
        <ul className="mb-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((s) => (
            <li
              key={s.id}
              className="group flex flex-col rounded-[18px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-4 shadow-card"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-[13px] text-[color:var(--color-text-muted)]">
                  {s.emoji} {streakName(t, s.kind, s.label)}
                </p>
                {/*
                  The ONLY thing between a sobriety count and every
                  member of the site, so it names the state it is in
                  rather than the action it performs.
                */}
                <VisibilityPill streak={s} onToggle={patch} />
              </div>

              <p className="mt-1 text-[30px] font-semibold leading-none tabular-nums">{s.days}</p>
              <p className="mt-1 text-[12.5px] text-[color:var(--color-text-subtle)]">
                {t("progress.sinceDate", "{unit} · since {date}", {
                  unit: streakUnit(t, s.kind),
                  date: s.startedOn,
                })}
              </p>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-[color:var(--color-border-soft)] pt-2.5">
                <span className="text-[12px] text-[color:var(--color-text-subtle)]">
                  {s.bestDays > s.days
                    ? t("progress.bestSoFar", "Best so far: {n} days", { n: s.bestDays })
                    : t("progress.longestYet", "Your longest yet")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setResetting(s);
                    setResetDate(today());
                  }}
                  className="text-[12.5px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:underline"
                >
                  {t("progress.startAgain", "Start again")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/*
        The journal count used to be a sentence here as well as a
        number in the hero. Saying it twice on one screen made the
        second one read as a different statistic. It is a tile above;
        this keeps only the part the tile cannot carry — the way
        through to the journal itself.
      */}
      {journalDays > 0 && (
        <p className="-mt-3 mb-6 text-[12.5px] text-[color:var(--color-text-subtle)]">
          <Link href="/journal" className="text-[color:var(--color-brand)] hover:underline">
            {t("progress.openJournal", "Open your journal")}
          </Link>
        </p>
      )}

      {/*
        ── milestones ───────────────────────────────────────────
        A DIVIDED LIST IN ONE CARD, not a grid of bordered cards.

        Fifteen bordered cards with a description on each ran to most
        of a screen and read as an inventory to work through. A list
        with hairlines between the rows is the same information at
        roughly half the height, and it scans — which is what somebody
        does with this section. Same shape as DazzlingDish's tier
        ladder, for the same reason.

        EARNED FIRST. The registry order groups by theme, which is the
        right order for a catalogue and the wrong one for a person:
        it scatters the three you have earned among twelve you have
        not. Sorted, the top of the list is what you did.

        Locked rows stay on the page at reduced opacity rather than
        being hidden behind a filter — the twelve you have not earned
        are the part that says what this place counts as worth doing.
      */}
      <section className="overflow-hidden rounded-[20px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[color:var(--color-border-soft)] px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold">{t("progress.milestones", "Milestones")}</h2>
            <p className="mt-0.5 text-[12px] text-[color:var(--color-text-muted)]">
              {t("progress.milestonesBlurb", "These show on your profile. Nothing here expires.")}
            </p>
          </div>
          <div className="flex min-w-[140px] flex-1 items-center gap-2 sm:max-w-[220px]">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--color-surface-muted)]">
              <div
                className="h-full rounded-full bg-[color:var(--color-brand)] transition-[width] duration-500"
                style={{ width: `${badges.length ? (earned.length / badges.length) * 100 : 0}%` }}
              />
            </div>
            <span className="shrink-0 text-[12px] tabular-nums text-[color:var(--color-text-subtle)]">
              {earned.length}/{badges.length}
            </span>
          </div>
        </div>

        <ul className="divide-y divide-[color:var(--color-border-soft)]">
          {ordered.map((b) => (
            <li
              key={b.slug}
              className={
                "flex items-center gap-3 px-4 py-2.5 " +
                (b.earnedAt ? "" : "opacity-55")
              }
            >
              <MilestoneChip
                emoji={b.emoji}
                name={badgeText(t, b).name}
                earned={!!b.earnedAt}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="text-[13.5px] font-semibold">{badgeText(t, b).name}</p>
                  {/* The group as a quiet suffix rather than a heading
                      of its own — four headings for fifteen items was
                      most of the old page's height. */}
                  <span className="text-[10.5px] uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)]">
                    {groups[b.group]}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] leading-snug text-[color:var(--color-text-muted)]">
                  {badgeText(t, b).description}
                </p>
              </div>
              {/*
                A word, not a tick and not a lock icon. "Earned" says
                the thing plainly; a padlock beside a recovery
                milestone somebody has not reached reads as a taunt.
              */}
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.06em]">
                {b.earnedAt ? (
                  <span className="text-[color:var(--color-brand)]">{t("progress.earned", "Earned")}</span>
                ) : (
                  <span className="text-[color:var(--color-text-subtle)]">{t("progress.notYet", "Not yet")}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {resetting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setResetting(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("progress.startAgain", "Start again")}
            className="w-full max-w-md rounded-2xl bg-[color:var(--color-surface)] p-5 shadow-elevated"
          >
            <h2 className="text-[16px] font-semibold">{t("progress.startAgain", "Start again")}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-text-muted)]">
              {t(
                "progress.resetBlurb",
                "Your {n} {unit} stays as your best so far. Nothing is announced and nobody is told.",
                {
                  n: resetting.days,
                  unit: resetting.days === 1 ? t("rail.day", "day") : t("rail.days", "days"),
                },
              )}
            </p>
            <label className="mt-3 block">
              <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
                {t("progress.startingFrom", "Starting from")}
              </span>
              <Input
                type="date"
                value={resetDate}
                max={today()}
                onChange={(e) => setResetDate(e.target.value)}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setResetting(null)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button size="sm" onClick={doReset} loading={busy}>
                {t("progress.startAgain", "Start again")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </SiteShell>
  );
}
