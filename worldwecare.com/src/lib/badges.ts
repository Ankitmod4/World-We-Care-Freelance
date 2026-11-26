/**
 * Badges — "meaningful milestones, not gimmicks". plan.docx §4.
 *
 * THE DEFINITIONS LIVE HERE, NOT IN THE DATABASE. A badge is a rule
 * about facts, and a rule belongs somewhere it can be read, reviewed
 * and tested. The `user_badges` table records only that a member met a
 * rule and when; an admin cannot hand one out, and nobody can edit the
 * meaning of "30 days sober" from a settings screen.
 *
 * EARNED ONCE, KEPT FOREVER. `recomputeBadges` only ever inserts. A
 * member who resets a sobriety streak does not lose the badge for the
 * thirty days they actually did — taking it back would be the cruellest
 * possible use of this table, and the code cannot do it.
 *
 * TWO OF THE PLAN'S EXAMPLES ARE NOT HERE, deliberately:
 *
 *   • "100 hours volunteered" — nothing in this codebase records hours.
 *     Inventing a number would be worse than not having the badge, so
 *     volunteering is counted in days from a declared start instead.
 *   • "first fundraiser started" — campaigns are admin-created; there
 *     is no member path to starting one. "First petition started" is
 *     the same act by a member, and is real.
 *
 * Both are one small feature away and are noted rather than faked.
 */

import { prisma } from "./db";
import { daysSince } from "./streaks";

export interface BadgeDef {
  slug: string;
  name: string;
  /** Said to the member who earned it, in the second person. */
  description: string;
  emoji: string;
  /** Grouping for the profile grid. */
  group: "recovery" | "writing" | "community" | "action";
}

/**
 * The registry. Order is display order.
 *
 * Anything not in here that somehow lands in the table is ignored
 * rather than rendered — a retired badge degrades to "not shown",
 * never to a broken profile.
 */
export const BADGES: BadgeDef[] = [
  // ── recovery ──
  { slug: "sober-30", name: "Thirty days", description: "Thirty days on your sobriety streak.", emoji: "\u{1F331}", group: "recovery" },
  { slug: "sober-90", name: "Ninety days", description: "Ninety days. That is a season of your life.", emoji: "\u{1F33F}", group: "recovery" },
  { slug: "sober-365", name: "A year", description: "A full year sober.", emoji: "\u{1F333}", group: "recovery" },
  { slug: "started-again", name: "Started again", description: "You reset a streak and kept going. That is the hard part.", emoji: "\u{1F504}", group: "recovery" },

  // ── writing ──
  { slug: "first-entry", name: "First words", description: "You wrote your first private journal entry.", emoji: "\u{270D}\u{FE0F}", group: "writing" },
  { slug: "journal-30", name: "Thirty entries", description: "Thirty entries in your journal.", emoji: "\u{1F4D3}", group: "writing" },
  { slug: "opened-up", name: "Opened up", description: "You shared something from your journal.", emoji: "\u{1F513}", group: "writing" },
  { slug: "grateful-10", name: "Ten gratitudes", description: "Ten posts on the gratitude wall.", emoji: "\u{1F49B}", group: "writing" },

  // ── community ──
  { slug: "first-post", name: "Said hello", description: "Your first post in the community.", emoji: "\u{1F44B}", group: "community" },
  { slug: "first-reply", name: "First reply", description: "You answered somebody.", emoji: "\u{1F4AC}", group: "community" },
  { slug: "crisis-responder", name: "There at 2am", description: "You replied in a crisis room.", emoji: "\u{1F6DF}", group: "community" },
  { slug: "hero-spotter", name: "Hero spotter", description: "A Town Hero you nominated was published.", emoji: "\u{2B50}", group: "community" },

  // ── action ──
  { slug: "showed-up", name: "Showed up", description: "You said yes to a real event.", emoji: "\u{1F6B6}", group: "action" },
  { slug: "petition-starter", name: "Asked for change", description: "You started a petition.", emoji: "\u{1F4DC}", group: "action" },
  { slug: "gave", name: "Gave", description: "You supported a cause with a donation.", emoji: "\u{1F49D}", group: "action" },
];

const BY_SLUG = new Map(BADGES.map((b) => [b.slug, b]));

export interface EarnedBadge extends BadgeDef {
  earnedAt: string;
}

/**
 * Which badges a member has met the rules for, right now.
 *
 * Counted rather than incremented — the same self-healing choice the
 * article counters make. There is no event plumbing to forget to call,
 * and a badge cannot be missed because a fire-and-forget hook
 * swallowed its error.
 */
async function earnedSlugs(userId: string): Promise<string[]> {
  const [
    streaks,
    entries,
    shared,
    gratitude,
    posts,
    comments,
    crisisReplies,
    heroes,
    rsvps,
    petitions,
    donations,
  ] = await Promise.all([
    prisma.userStreak.findMany({
      where: { userId },
      select: { kind: true, startedOn: true, bestDays: true, resetCount: true },
    }),
    prisma.dailyReflection.count({ where: { userId } }),
    prisma.dailyReflection.count({ where: { userId, sharedPostId: { not: null } } }),
    prisma.gratitudeEntry.count({ where: { authorId: userId, status: "APPROVED" } }),
    prisma.post.count({ where: { authorId: userId } }),
    prisma.postComment.count({ where: { authorId: userId } }),
    prisma.chatMessage.count({ where: { authorId: userId, room: { tier: "CRISIS" } } }),
    prisma.townHero.count({ where: { nominatedByUserId: userId, status: "APPROVED" } }),
    prisma.eventRsvp.count({ where: { userId } }),
    prisma.petition.count({ where: { creatorUserId: userId } }),
    prisma.donation.count({ where: { donorUserId: userId, status: "SUCCEEDED" } }),
  ]);

  const out: string[] = [];

  // The best a sobriety streak has EVER reached, not where it is now.
  const sober = streaks.filter((s) => s.kind === "SOBER");
  const bestSober = sober.reduce(
    (n, s) => Math.max(n, s.bestDays, daysSince(s.startedOn)),
    0,
  );
  if (bestSober >= 30) out.push("sober-30");
  if (bestSober >= 90) out.push("sober-90");
  if (bestSober >= 365) out.push("sober-365");
  if (streaks.some((s) => s.resetCount > 0)) out.push("started-again");

  if (entries >= 1) out.push("first-entry");
  if (entries >= 30) out.push("journal-30");
  if (shared >= 1) out.push("opened-up");
  if (gratitude >= 10) out.push("grateful-10");

  if (posts >= 1) out.push("first-post");
  if (comments >= 1) out.push("first-reply");
  if (crisisReplies >= 1) out.push("crisis-responder");
  if (heroes >= 1) out.push("hero-spotter");

  if (rsvps >= 1) out.push("showed-up");
  if (petitions >= 1) out.push("petition-starter");
  if (donations >= 1) out.push("gave");

  return out;
}

/**
 * Award anything newly earned. Never takes one back.
 *
 * Safe to call on every profile view: it inserts only what is missing,
 * and `skipDuplicates` makes a race between two tabs harmless.
 */
export async function recomputeBadges(userId: string): Promise<void> {
  try {
    const [should, have] = await Promise.all([
      earnedSlugs(userId),
      prisma.userBadge.findMany({ where: { userId }, select: { slug: true } }),
    ]);
    const known = new Set(have.map((b) => b.slug));
    const missing = should.filter((slug) => !known.has(slug));
    if (!missing.length) return;

    await prisma.userBadge.createMany({
      data: missing.map((slug) => ({ userId, slug })),
      skipDuplicates: true,
    });
  } catch (err) {
    // A badge is a nice-to-have on somebody's profile. It must never
    // be the reason the profile fails to render.
    console.warn("[badges] recompute failed:", err);
  }
}

/** What to show, newest first. Unknown slugs are dropped, not rendered. */
export async function listBadges(userId: string): Promise<EarnedBadge[]> {
  const rows = await prisma.userBadge.findMany({
    where: { userId },
    select: { slug: true, earnedAt: true },
    orderBy: { earnedAt: "desc" },
  });
  return rows.flatMap((r) => {
    const def = BY_SLUG.get(r.slug);
    return def ? [{ ...def, earnedAt: r.earnedAt.toISOString() }] : [];
  });
}

/**
 * Badges on a public profile — all of them.
 *
 * No gate, and no switch behind it. A badge says somebody turned up,
 * replied, or kept going; none of it discloses anything they would not
 * say out loud, so there is nothing here to protect them from.
 *
 * Streaks go the other way — see `listPublicStreaks`, where the
 * per-streak tick is off until the member sets it. The asymmetry is
 * deliberate and is the reason these are two functions rather than one.
 */
export async function listPublicBadges(userId: string): Promise<EarnedBadge[]> {
  return listBadges(userId);
}

/** The whole set, with which ones this member has — for the profile grid. */
export async function badgeProgress(
  userId: string,
): Promise<Array<BadgeDef & { earnedAt: string | null }>> {
  const earned = new Map((await listBadges(userId)).map((b) => [b.slug, b.earnedAt]));
  return BADGES.map((b) => ({ ...b, earnedAt: earned.get(b.slug) ?? null }));
}
