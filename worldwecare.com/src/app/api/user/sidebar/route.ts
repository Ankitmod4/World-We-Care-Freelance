/**
 * GET /api/user/sidebar — everything the left rail needs, in one call.
 *
 * ONE REQUEST, NOT FOUR. The sidebar renders on every signed-in page,
 * so the counts, the streak, the badges and the joined rooms would
 * otherwise be four round trips on every navigation. They are also
 * useless separately — a card that renders its name and then pops in
 * three numbers a moment later is worse than one that arrives whole.
 *
 * Every part is independently fault-tolerant: one slow or broken query
 * returns its empty value rather than taking the rail down, because
 * the rail is also the navigation and losing it strands the member.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { getJourneyStats } from "@/lib/profile";
import { listStreaks } from "@/lib/streaks";
import { listBadges } from "@/lib/badges";
import { listRoomsForUser } from "@/lib/chat-user";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const [stats, streaks, badges, rooms] = await Promise.all([
    getJourneyStats(auth.id).catch(() => null),
    listStreaks(auth.id).catch(() => []),
    listBadges(auth.id).catch(() => []),
    listRoomsForUser({ viewerId: auth.id }).catch(() => []),
  ]);

  // The headline: the longest live streak. Whether it is PUBLIC is
  // irrelevant here — this is the member's own rail, and hiding their
  // own number from them was never the point of that flag.
  const live = streaks.filter((s) => !s.archived);
  const topStreak =
    live.reduce<(typeof live)[number] | null>(
      (best, s) => (!best || s.days > best.days ? s : best),
      null,
    ) ?? null;

  return NextResponse.json({
    stats: stats ?? { posts: 0, followers: 0, following: 0 },
    /*
       `kind` and `label` travel, not the English `name`.

       The rail showed "Sober" in the middle of an otherwise Russian
       card, because this handed down a name the server had already
       resolved to English. The words are the browser's job — see
       `streak-text` — so what goes over the wire is what the words
       are built FROM: the kind, and whatever the member typed for a
       custom one, which is never translated.
    */
    topStreak: topStreak && {
      kind: topStreak.kind,
      label: topStreak.label,
      name: topStreak.name,
      emoji: topStreak.emoji,
      unit: topStreak.unit,
      days: topStreak.days,
    },
    // Earned only, newest first — the rail shows what somebody has,
    // not what they are missing.
    badges: badges.slice(0, 6).map((b) => ({ slug: b.slug, name: b.name, emoji: b.emoji })),
    badgeCount: badges.length,
    // Joined rooms only. The rail is a shortcut back to conversations
    // the member is already in, not a directory — that is /chatrooms.
    rooms: (rooms as Array<Record<string, unknown>>)
      .filter((r) => r.isMember)
      .slice(0, 8)
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        emoji: r.emoji ?? null,
        color: r.color ?? null,
        tier: r.tier ?? "PUBLIC",
        unread: typeof r.unread === "number" ? r.unread : 0,
      })),
  });
}
