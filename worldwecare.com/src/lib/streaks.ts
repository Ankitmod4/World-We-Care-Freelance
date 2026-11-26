/**
 * Streaks — "days sober, days meditated, days volunteered, days
 * journaled", counted from a date the member declared.
 *
 * WHY A DATE AND NOT A DAILY CHECK-IN. A check-in streak is a number
 * that quietly resets because somebody had a bad week and did not open
 * an app. For "days sober" that is not a lapsed habit tracker, it is a
 * platform telling a person in recovery that they lost something they
 * did not lose. A declared date counts itself, works retroactively for
 * people who were already months in when they signed up, and asks
 * nothing on the days they have least to give.
 *
 * NOTHING HERE EXPIRES. There is no sweeper, no lapse, no "you broke
 * your streak". The only thing that moves `startedOn` is the member
 * pressing reset, and `bestDays` survives it — starting again does not
 * erase what was already done, which is the whole reason the button is
 * pressable at all.
 *
 * DATES ARE PLAIN DATES. `startedOn` is a `@db.Date`; the day count is
 * whole days between two calendar dates, not a duration in
 * milliseconds. A member in Cork and a member in Denver both see the
 * same number for the same start date, which is what they would say
 * out loud to each other.
 */

import type { Prisma, StreakKind } from "@prisma/client";
import { prisma } from "./db";
import { STREAK_LABELS, describeDays } from "./streak-text";

export { STREAK_LABELS, describeDays };

export const STREAK_KINDS = ["SOBER", "MEDITATION", "VOLUNTEERING", "JOURNALING", "CUSTOM"] as const;

export interface StreakView {
  id: string;
  kind: StreakKind;
  /** The member's own label, if they wrote one. Never translated. */
  label: string | null;
  /** The member's own label for CUSTOM, else the English built-in. */
  name: string;
  unit: string;
  emoji: string;
  startedOn: string;
  /** Whole days since `startedOn`, inclusive of the start day. */
  days: number;
  bestDays: number;
  resetCount: number;
  isPublic: boolean;
  archived: boolean;
}

/* ── day maths ───────────────────────────────────────────────── */

/** Today as a plain UTC date, with no time on it. */
export function todayUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const MS_PER_DAY = 86_400_000;

/**
 * Whole days from `startedOn` to `on`, counting the start day as day 1.
 *
 * Day 1 rather than day 0 because that is how people say it: somebody
 * who stopped this morning is on their first day, not their zeroth. A
 * future date reads as 0 — a member typing next month's date should
 * see nothing, not a negative number.
 */
export function daysSince(startedOn: Date, on: Date = todayUtc()): number {
  const a = Date.UTC(startedOn.getUTCFullYear(), startedOn.getUTCMonth(), startedOn.getUTCDate());
  const b = Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate());
  if (b < a) return 0;
  return Math.floor((b - a) / MS_PER_DAY) + 1;
}

/* ── reading ─────────────────────────────────────────────────── */

const SELECT = {
  id: true,
  kind: true,
  label: true,
  startedOn: true,
  isPublic: true,
  bestDays: true,
  resetCount: true,
  archivedAt: true,
} satisfies Prisma.UserStreakSelect;

function shape(row: Prisma.UserStreakGetPayload<{ select: typeof SELECT }>): StreakView {
  const meta = STREAK_LABELS[row.kind];
  const days = daysSince(row.startedOn);
  return {
    id: row.id,
    kind: row.kind,
    label: row.label?.trim() || null,
    name: row.kind === "CUSTOM" ? (row.label?.trim() || meta.name) : meta.name,
    unit: row.kind === "CUSTOM" ? "days" : meta.unit,
    emoji: meta.emoji,
    startedOn: row.startedOn.toISOString().slice(0, 10),
    days,
    // The live run can already beat what was stored; report the truth
    // rather than a number that only updates when something is saved.
    bestDays: Math.max(row.bestDays, days),
    resetCount: row.resetCount,
    isPublic: row.isPublic,
    archived: !!row.archivedAt,
  };
}

/** A member's own streaks. Archived ones last, not hidden. */
export async function listStreaks(userId: string): Promise<StreakView[]> {
  const rows = await prisma.userStreak.findMany({
    where: { userId },
    select: SELECT,
    orderBy: [{ archivedAt: "asc" }, { startedOn: "asc" }],
  });
  return rows.map(shape);
}

/**
 * What another member may see.
 *
 * ONE GATE: the streak's own `isPublic`. There used to be an
 * account-level switch above this as well; it went because two
 * switches meant a member could tick "show" on a streak and still see
 * nothing appear, with no clue which of the two was holding it back.
 *
 * The gate now starts OPEN for streaks created from here on, and the
 * composer says so before anything is saved. It is still per-streak,
 * which is the part that matters: somebody can show "days
 * volunteering" and keep "days sober" to themselves, and one tick
 * takes any of them back off the profile at any time.
 */
export async function listPublicStreaks(userId: string): Promise<StreakView[]> {
  const rows = await prisma.userStreak.findMany({
    where: { userId, isPublic: true, archivedAt: null },
    select: SELECT,
    orderBy: [{ startedOn: "asc" }],
  });
  return rows.map(shape);
}

/* ── writing ─────────────────────────────────────────────────── */

export class StreakRefused extends Error {}

/** Parse "2026-03-03" into a plain UTC date, or throw. */
function parseDay(raw: unknown): Date {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new StreakRefused("Pick a date.");
  }
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new StreakRefused("That isn't a date.");
  if (d.getTime() > todayUtc().getTime()) {
    throw new StreakRefused("That's in the future — pick the day it started.");
  }
  return d;
}

/**
 * NEW STREAKS START PUBLIC. Omitting `isPublic` means public, not
 * private — the opposite of what this function used to do.
 *
 * The reasoning for the old default was that nothing about somebody's
 * recovery should appear on a public profile because a feature
 * shipped. That still holds for streaks people have ALREADY started,
 * which is why nothing here backfills: a member who set a streak up
 * under the old default keeps it private until they say otherwise.
 * This changes what happens next, not what happened.
 *
 * What makes the new default defensible is that the composer shows
 * it, ticked, before anything is written — see progress-client. A
 * default a person can see and untick is a default; one they discover
 * afterwards on their own profile is a leak.
 */
export async function startStreak(
  userId: string,
  input: { kind: StreakKind; startedOn: string; label?: string | null; isPublic?: boolean },
): Promise<StreakView> {
  const startedOn = parseDay(input.startedOn);
  const label = input.label?.trim().slice(0, 80) || null;
  if (input.kind === "CUSTOM" && !label) {
    throw new StreakRefused("Give it a name — whatever you'd call it yourself.");
  }

  // One live streak per kind, so a profile can't show two different
  // "days sober" numbers. CUSTOM is exempt: those are whatever the
  // member wants and there can be several.
  if (input.kind !== "CUSTOM") {
    const existing = await prisma.userStreak.findFirst({
      where: { userId, kind: input.kind, archivedAt: null },
      select: { id: true },
    });
    if (existing) throw new StreakRefused("You're already tracking that one.");
  }

  const row = await prisma.userStreak.create({
    data: {
      userId,
      kind: input.kind,
      label,
      startedOn,
      // `?? true`, NOT `!!` — an omitted flag now means public. The
      // caller has to say `false` to get a private one.
      isPublic: input.isPublic ?? true,
    },
    select: SELECT,
  });
  return shape(row);
}

/**
 * Start again from a new date.
 *
 * The run that just ended is banked into `bestDays` first. Nothing is
 * deleted and nothing is announced: no notification, no post, no entry
 * in anybody's feed. A reset is a private thing.
 */
export async function resetStreak(
  userId: string,
  streakId: string,
  startedOn: string,
): Promise<StreakView> {
  const current = await prisma.userStreak.findFirst({
    where: { id: streakId, userId },
    select: { startedOn: true, bestDays: true },
  });
  if (!current) throw new StreakRefused("That one's gone.");

  const ran = daysSince(current.startedOn);
  const row = await prisma.userStreak.update({
    where: { id: streakId },
    data: {
      startedOn: parseDay(startedOn),
      bestDays: Math.max(current.bestDays, ran),
      resetCount: { increment: 1 },
      archivedAt: null,
    },
    select: SELECT,
  });
  return shape(row);
}

/** Correct a typo in the start date. Does NOT touch bestDays. */
export async function editStreak(
  userId: string,
  streakId: string,
  input: { startedOn?: string; label?: string | null; isPublic?: boolean },
): Promise<StreakView> {
  const owned = await prisma.userStreak.findFirst({
    where: { id: streakId, userId },
    select: { id: true },
  });
  if (!owned) throw new StreakRefused("That one's gone.");

  const data: Prisma.UserStreakUpdateInput = {};
  if (input.startedOn !== undefined) data.startedOn = parseDay(input.startedOn);
  if (input.label !== undefined) data.label = input.label?.trim().slice(0, 80) || null;
  if (input.isPublic !== undefined) data.isPublic = !!input.isPublic;

  const row = await prisma.userStreak.update({
    where: { id: streakId },
    data,
    select: SELECT,
  });
  return shape(row);
}

/** Stop tracking, keep the history. */
export async function archiveStreak(userId: string, streakId: string): Promise<void> {
  const owned = await prisma.userStreak.findFirst({
    where: { id: streakId, userId },
    select: { startedOn: true, bestDays: true },
  });
  if (!owned) throw new StreakRefused("That one's gone.");
  await prisma.userStreak.update({
    where: { id: streakId },
    data: {
      archivedAt: new Date(),
      bestDays: Math.max(owned.bestDays, daysSince(owned.startedOn)),
    },
  });
}

/** Really delete it — for a member who wants it gone, not archived. */
export async function deleteStreak(userId: string, streakId: string): Promise<void> {
  await prisma.userStreak.deleteMany({ where: { id: streakId, userId } });
}
