/**
 * The daily digest email. "A short summary at whatever time of day the
 * user picks: today's positive quote, a reminder about their streak, a
 * suggestion for one small thing they could do today. Opt-in, easy to
 * turn off." — plan.docx §4.
 *
 * THERE IS NO SCHEDULER IN THIS PROJECT. Nothing here runs itself.
 * `runDigest()` is called by `prisma/send-digests.ts`, which an
 * operator wires to cron or a systemd timer — see the header of that
 * file for the exact line. Everything below is written on the
 * assumption that the runner fires roughly hourly and may fire twice,
 * late, or not at all.
 *
 * WHICH MEANS IDEMPOTENCY IS THE WHOLE DESIGN. `digestLastSentOn`
 * holds the member's LOCAL date of the last send, and is written in the
 * same statement that selects them. A runner that fires three times in
 * an hour sends one email; a runner that missed 3am and catches up at
 * 6am still sends one.
 *
 * TIMEZONES WITHOUT A LIBRARY. `Intl.DateTimeFormat` with a timeZone
 * gives the member's local hour and date directly. A member with no
 * timezone set is treated as UTC rather than skipped — being emailed at
 * an odd hour is a smaller failure than an opt-in that silently never
 * arrives.
 */

import { prisma } from "./db";
import { sendEmail } from "./email";
import { getSetting } from "./settings";
import { appUrlFromEnv } from "./app-url";
import { listStreaks, describeDays } from "./streaks";
import { journalingStreak } from "./journal";

export const DIGEST_TEMPLATE_SLUG = "daily_digest";

/** The member's local hour (0-23) and calendar date, right now. */
export function localNow(timezone: string | null, at: Date = new Date()): { hour: number; day: string } {
  const tz = timezone || "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
    }).formatToParts(at);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    // en-CA gives ISO-ish parts, and hour "24" means midnight here.
    const hour = Number(get("hour")) % 24;
    return { hour, day: `${get("year")}-${get("month")}-${get("day")}` };
  } catch {
    // An unknown timezone string must not take the whole run down.
    const iso = at.toISOString();
    return { hour: at.getUTCHours(), day: iso.slice(0, 10) };
  }
}

export interface DigestContent {
  quote: string;
  attribution: string;
  question: string;
  streakLine: string;
  suggestion: string;
}

/**
 * One small thing to do today.
 *
 * Chosen from what this member has NOT done rather than at random, so
 * it reads as noticing rather than nagging, and rotated by the date so
 * the same person is not told the same thing every morning.
 */
function suggestionFor(opts: {
  hasStreak: boolean;
  wroteToday: boolean;
  day: string;
}): string {
  const pool: string[] = [];
  if (!opts.wroteToday) pool.push("Write a line in your journal — nobody else will read it.");
  if (!opts.hasStreak) pool.push("Start a streak. It counts from a date you pick, so you can backdate it.");
  pool.push("Read the gratitude wall for a minute.");
  pool.push("Say something in a room you have been quietly reading.");
  pool.push("Look at what's on near you this week.");
  const n = Number(opts.day.replaceAll("-", "")) || 0;
  return pool[n % pool.length] ?? pool[0]!;
}

/** Everything the template needs for one member. */
export async function buildDigest(userId: string, day: string): Promise<DigestContent> {
  const date = new Date(`${day}T00:00:00.000Z`);
  const [quote, question, streaks, journalDays] = await Promise.all([
    prisma.dailyQuote.findFirst({
      where: { displayDate: date, isActive: true },
      select: { body: true, attribution: true },
    }),
    prisma.dailyQuestion.findFirst({
      where: { displayDate: date, isActive: true },
      select: { body: true },
    }),
    listStreaks(userId),
    journalingStreak(userId),
  ]);

  const live = streaks.filter((s) => !s.archived);
  const streakLine = live.length
    ? live.map((s) => `${s.name}: ${describeDays(s.days)}`).join(" · ")
    : journalDays > 0
      ? `Journaling: ${describeDays(journalDays)} in a row`
      : "No streaks yet — you can start one whenever you like.";

  return {
    quote: quote?.body ?? "",
    attribution: quote?.attribution ?? "",
    question: question?.body ?? "",
    streakLine,
    suggestion: suggestionFor({
      hasStreak: live.length > 0,
      wroteToday: journalDays > 0,
      day,
    }),
  };
}

export interface DigestRunResult {
  considered: number;
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * Send to everyone whose local hour has arrived and who has not had one
 * today.
 *
 * `dryRun` builds and selects but sends nothing and writes nothing —
 * which is how an operator checks a cron line without emailing the
 * whole membership at 4am.
 */
export async function runDigest(
  opts: { at?: Date; dryRun?: boolean; limit?: number } = {},
): Promise<DigestRunResult> {
  const at = opts.at ?? new Date();
  const limit = Math.min(2000, Math.max(1, opts.limit ?? 500));
  const result: DigestRunResult = { considered: 0, sent: 0, skipped: 0, failed: 0 };

  // No request to read a Host header from — a cron job has no request.
  // `APP_URL` is the only trustworthy source here, which is the same
  // reason app-url.ts prefers it for password-reset links.
  const appUrl = appUrlFromEnv();
  const siteName = await getSetting("general.siteName", "WorldWeCare");

  const candidates = await prisma.user.findMany({
    where: {
      digestEnabled: true,
      isActive: true,
      bannedAt: null,
      // Never email an address nobody has confirmed.
      emailVerifiedAt: { not: null },
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      timezone: true,
      digestHour: true,
      digestLastSentOn: true,
    },
    take: limit,
  });

  for (const user of candidates) {
    const { hour, day } = localNow(user.timezone, at);
    if (hour !== user.digestHour) continue;

    const already = user.digestLastSentOn?.toISOString().slice(0, 10);
    if (already === day) continue;

    result.considered += 1;
    if (opts.dryRun) {
      result.skipped += 1;
      continue;
    }

    // Claim the day BEFORE sending. Two runners overlapping would
    // otherwise both pass the check and both send; a crash after this
    // line costs one missed digest, which is the better failure.
    const claimed = await prisma.user.updateMany({
      where: {
        id: user.id,
        OR: [{ digestLastSentOn: null }, { digestLastSentOn: { lt: new Date(`${day}T00:00:00.000Z`) } }],
      },
      data: { digestLastSentOn: new Date(`${day}T00:00:00.000Z`) },
    });
    if (claimed.count === 0) {
      result.skipped += 1;
      continue;
    }

    try {
      const content = await buildDigest(user.id, day);
      const res = await sendEmail({
        templateSlug: DIGEST_TEMPLATE_SLUG,
        to: user.email,
        variables: {
          name: user.displayName,
          siteName,
          appUrl,
          quote: content.quote,
          attribution: content.attribution,
          question: content.question,
          streakLine: content.streakLine,
          suggestion: content.suggestion,
          settingsUrl: `${appUrl}/settings`,
        },
      });
      if (res.status === "sent") result.sent += 1;
      else if (res.status === "skipped") result.skipped += 1;
      else result.failed += 1;
    } catch (err) {
      console.warn(`[digest] failed for ${user.id}:`, err);
      result.failed += 1;
    }
  }

  return result;
}
