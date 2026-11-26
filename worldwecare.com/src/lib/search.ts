/**
 * Site-wide search.
 *
 * One query, five tables, run in parallel and capped hard. This is a
 * `LIKE '%term%'` search, not a full-text index, and it is honest about
 * that: a leading wildcard cannot use an index, so every one of these
 * is a scan. The defences are the ones that matter at this size —
 *
 *   • a minimum term length, so `?q=a` can't scan five tables
 *   • a per-table cap of 6 rows, so a common word can't return 4,000
 *   • the term is passed as a Prisma value, never interpolated, so the
 *     `%` and `_` a member types are matched literally rather than
 *     becoming wildcards of their own
 *
 * When this stops being fast enough the fix is a MySQL FULLTEXT index
 * on the title columns and a MATCH…AGAINST query behind the same
 * function signature. Nothing above this line would have to change.
 *
 * WHAT IS SEARCHABLE IS WHAT IS PUBLIC. Each query repeats the status
 * filter its own reader uses — a draft article, a pending event or an
 * unapproved place must not surface here just because someone guessed
 * a word in its title. If you add a surface, add its status filter with
 * it.
 *
 * MEMBERS ARE MATCHED ON THEIR DISPLAY NAME AND NOTHING ELSE.
 *
 * Not the email, obviously — a search box that confirms whether an
 * address has an account here is a disclosure, and on a site about
 * addiction and mental health it is a serious one.
 *
 * And not the bio either, though it is public on the profile page.
 * People write things there they are willing to have read BY SOMEONE
 * WHO CAME TO THEIR PROFILE. Making it a search index is a different
 * thing: type "relapse" and you get a list of people, which is not a
 * feature anyone here asked for. A name is what you search a person
 * by; that is all this does.
 */

import { prisma } from "./db";
import { getBlockedIds } from "./blocks";

export const SEARCH_MIN = 2;
const PER_TYPE = 6;

export type SearchKind = "member" | "article" | "place" | "event" | "campaign" | "room";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  href: string;
  title: string;
  subtitle: string | null;
  /**
   * Events only: the subtitle is the word "Online" rather than a city.
   *
   * The flag travels instead of the word because the word was being
   * chosen in this file — on the server, with no reader — so every
   * online event read "Online" in the middle of a translated results
   * list. A city is a place name and stays as it is; "Online" is
   * interface text and belongs to `t()` in the component.
   */
  onlineLabel?: boolean;
  emoji: string;
  /** Members only — the list shows a face instead of the emoji tile. */
  avatarUrl?: string | null;
}

export interface SearchResults {
  q: string;
  hits: SearchHit[];
  counts: Record<SearchKind, number>;
  truncated: boolean;
}

const EMPTY: Record<SearchKind, number> = {
  member: 0,
  article: 0,
  place: 0,
  event: 0,
  campaign: 0,
  room: 0,
};

export async function searchEverything(
  rawQuery: string,
  opts: { countryId?: string | null; viewerId?: string | null } = {},
): Promise<SearchResults> {
  const q = rawQuery.trim().slice(0, 120);
  if (q.length < SEARCH_MIN) {
    return { q, hits: [], counts: { ...EMPTY }, truncated: false };
  }

  const like = { contains: q };
  // Country narrows the three things that have a country. Articles and
  // rooms are deliberately global: an article is worth reading wherever
  // it was written.
  const country = opts.countryId ? { countryId: opts.countryId } : {};

  // Someone the viewer has blocked should not come back as a result —
  // the block is meant to make that person go away, and a search box
  // that still finds them is a hole in it.
  const blockedIds = opts.viewerId ? await getBlockedIds(opts.viewerId) : [];

  const [members, articles, places, events, campaigns, rooms] = await Promise.all([
    prisma.user.findMany({
      where: {
        // The same gate the profile page uses (src/lib/profile.ts): a
        // banned or deactivated account is not findable.
        isActive: true,
        bannedAt: null,
        displayName: like,
        // Both conditions land on `id`, so they go in one object rather
        // than two spreads — the second spread would silently replace
        // the first and quietly un-block everybody.
        ...(opts.viewerId || blockedIds.length
          ? {
              id: {
                ...(opts.viewerId ? { not: opts.viewerId } : {}),
                ...(blockedIds.length ? { notIn: blockedIds } : {}),
              },
            }
          : {}),
      },
      orderBy: { displayName: "asc" },
      take: PER_TYPE,
      select: { id: true, displayName: true, location: true, avatarUrl: true },
    }),
    prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        OR: [{ title: like }, { excerpt: like }],
      },
      orderBy: { publishedAt: "desc" },
      take: PER_TYPE,
      select: { id: true, slug: true, title: true, excerpt: true },
    }),
    prisma.place.findMany({
      where: {
        status: "APPROVED",
        ...country,
        OR: [{ name: like }, { city: like }, { summary: like }, { needs: like }],
      },
      orderBy: [{ isDonor: "desc" }, { name: "asc" }],
      take: PER_TYPE,
      select: { id: true, slug: true, name: true, city: true, type: true },
    }),
    prisma.event.findMany({
      where: {
        status: "APPROVED",
        ...country,
        OR: [{ title: like }, { summary: like }, { city: like }, { venueName: like }],
      },
      orderBy: { startsAt: "asc" },
      take: PER_TYPE,
      select: { id: true, slug: true, title: true, city: true, isOnline: true },
    }),
    prisma.campaign.findMany({
      where: {
        status: "PUBLISHED",
        ...country,
        OR: [{ title: like }, { summary: like }],
      },
      orderBy: { publishedAt: "desc" },
      take: PER_TYPE,
      select: { id: true, slug: true, title: true, summary: true, emoji: true },
    }),
    prisma.chatRoom.findMany({
      where: {
        status: "ACTIVE",
        // Crisis and Cavalry rooms are reached through their own flows,
        // not stumbled into from a search box.
        tier: { in: ["PUBLIC", "SUPPORT"] },
        OR: [{ name: like }, { description: like }],
      },
      orderBy: { memberCount: "desc" },
      take: PER_TYPE,
      select: { id: true, slug: true, name: true, description: true, emoji: true },
    }),
  ]);

  const hits: SearchHit[] = [
    ...members.map((m) => ({
      kind: "member" as const,
      id: m.id,
      href: `/u/${m.id}`,
      title: m.displayName,
      subtitle: m.location,
      emoji: "🙂",
      avatarUrl: m.avatarUrl,
    })),
    ...articles.map((a) => ({
      kind: "article" as const,
      id: a.id,
      href: `/articles/${a.slug}`,
      title: a.title,
      subtitle: a.excerpt,
      emoji: "📄",
    })),
    ...places.map((p) => ({
      kind: "place" as const,
      id: p.id,
      href: `/places/${p.slug}`,
      title: p.name,
      subtitle: p.city,
      emoji: "📍",
    })),
    ...events.map((e) => ({
      kind: "event" as const,
      id: e.id,
      href: `/events/${e.slug}`,
      title: e.title,
      subtitle: e.isOnline ? null : e.city,
      onlineLabel: e.isOnline,
      emoji: "📅",
    })),
    ...campaigns.map((c) => ({
      kind: "campaign" as const,
      id: c.id,
      href: `/campaigns/${c.slug}`,
      title: c.title,
      subtitle: c.summary,
      emoji: c.emoji || "📣",
    })),
    ...rooms.map((r) => ({
      kind: "room" as const,
      id: r.id,
      href: `/chatrooms/${r.slug}`,
      title: r.name,
      subtitle: r.description,
      emoji: r.emoji || "💬",
    })),
  ];

  const counts: Record<SearchKind, number> = {
    member: members.length,
    article: articles.length,
    place: places.length,
    event: events.length,
    campaign: campaigns.length,
    room: rooms.length,
  };

  return {
    q,
    hits,
    counts,
    // Any table that came back full probably had more to give. Say so,
    // rather than implying these are all the matches there are.
    truncated: Object.values(counts).some((n) => n === PER_TYPE),
  };
}

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  member: "Member",
  article: "Article",
  place: "Place",
  event: "Event",
  campaign: "Campaign",
  room: "Chatroom",
};
