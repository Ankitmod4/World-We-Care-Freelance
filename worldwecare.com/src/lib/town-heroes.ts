/**
 * Town Heroes — the people in a town who quietly do the work.
 *
 * Members nominate someone; an admin approves before it is public.
 * Reader and admin live in one file, like `gratitude.ts` and unlike
 * `articles.ts`/`articles-admin.ts`: the moderation states are the
 * same three states the reader has to know about anyway, and splitting
 * them was how the gratitude admin list and the gratitude wall ended
 * up with two different ideas of what "visible" means.
 *
 * TWO RULES RUN THROUGH ALL OF IT.
 *
 * 1. THE NOMINEE IS NOT A USER. `heroName` is a string somebody typed.
 *    Nobody has to sign up to be thanked, and the person most worth
 *    nominating is often the one least likely to be online. Nothing
 *    here may join `heroName` to the User table or assume it resolves.
 *
 * 2. ANONYMITY IS APPLIED ON THE WAY OUT, NOT AT REST. `isAnonymous`
 *    hides the nominator from readers; the row keeps who sent it,
 *    because a moderator dealing with a malicious nomination has to be
 *    able to see that. `shape()` is the only thing that decides, and
 *    every reader path goes through it.
 */

import type { Prisma, TownHeroStatus } from "@prisma/client";
import { prisma } from "./db";
import { getMasker } from "./banned-words";
import { slugify } from "./geography-admin";
import { createUserNotification } from "./notifications";

/**
 * Slugs that would collide with a route segment under /town-heroes.
 * Same reasoning as RESERVED_ARTICLE_SLUGS: Next resolves a static
 * segment before [slug], so a hero slugged "new" would be silently
 * unreachable behind the nominate page.
 */
export const RESERVED_HERO_SLUGS = new Set([
  "new",
  "nominate",
  "category",
  "mine",
  "search",
  "all",
  "town",
]);

export interface TownHeroView {
  id: string;
  slug: string;
  heroName: string;
  town: string | null;
  countryId: string | null;
  photoUrl: string | null;
  photoAlt: string;
  summary: string | null;
  /**
   * Always present — every hero is filed under something. Kept as an
   * object rather than a bare name so a card can show the emoji and
   * the colour without a second lookup.
   */
  category: { id: string; name: string; slug: string; emoji: string | null; color: string | null };
  /** Only sent for the single-hero page — the list doesn't need it. */
  body?: string;
  /** Null when the nomination is anonymous, or the nominator is gone. */
  nominatorName: string | null;
  isAnonymous: boolean;
  status: TownHeroStatus;
  rejectionReason: string | null;
  heartCount: number;
  hearted: boolean;
  /** The viewer nominated this one, so they may see it before approval. */
  isOwn: boolean;
  isFeatured: boolean;
  approvedAt: string | null;
  createdAt: string;
}

const CARD_SELECT = {
  id: true,
  slug: true,
  heroName: true,
  town: true,
  countryId: true,
  photoUrl: true,
  photoAlt: true,
  summary: true,
  category: { select: { id: true, name: true, slug: true, emoji: true, color: true } },
  nominatedByUserId: true,
  nominatorSnapshot: true,
  isAnonymous: true,
  status: true,
  rejectionReason: true,
  heartCount: true,
  isFeatured: true,
  approvedAt: true,
  createdAt: true,
} satisfies Prisma.TownHeroSelect;

type CardRow = Prisma.TownHeroGetPayload<{ select: typeof CARD_SELECT }> & { body?: string };

/**
 * The single place anonymity is enforced.
 *
 * `rejectionReason` goes only to the person who wrote the nomination —
 * a moderator's note about why something was turned down is not for
 * everyone else to read.
 */
function shape(row: CardRow, viewerId: string | null, heartedIds: Set<string>): TownHeroView {
  const isOwn = !!viewerId && row.nominatedByUserId === viewerId;
  return {
    id: row.id,
    slug: row.slug,
    heroName: row.heroName,
    town: row.town,
    countryId: row.countryId,
    photoUrl: row.photoUrl,
    photoAlt: row.photoAlt ?? "",
    summary: row.summary,
    category: row.category,
    ...(row.body !== undefined ? { body: row.body } : {}),
    nominatorName: row.isAnonymous ? null : (row.nominatorSnapshot ?? null),
    isAnonymous: row.isAnonymous,
    status: row.status,
    rejectionReason: isOwn ? row.rejectionReason : null,
    heartCount: Math.max(0, row.heartCount),
    hearted: heartedIds.has(row.id),
    isOwn,
    isFeatured: row.isFeatured,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function heartsFor(viewerId: string | null, heroIds: string[]): Promise<Set<string>> {
  if (!viewerId || !heroIds.length) return new Set();
  const rows = await prisma.townHeroHeart.findMany({
    where: { userId: viewerId, heroId: { in: heroIds } },
    select: { heroId: true },
  });
  return new Set(rows.map((r) => r.heroId));
}

/* ── reading ─────────────────────────────────────────────────── */

export interface HeroListFilters {
  viewerId?: string | null;
  countryId?: string | null;
  categorySlug?: string | null;
  q?: string | null;
  take?: number;
  /** 1-based page, used with `take` as the page size. */
  page?: number;
}

/**
 * The public list: APPROVED for everyone, plus the viewer's own
 * nominations whatever their state, so somebody who has just sent one
 * can see it waiting rather than wondering if it saved.
 *
 * Featured first, then newest approved. A nomination still pending has
 * no `approvedAt`, so it sorts by `createdAt` — which puts the
 * viewer's own fresh submission at the top where they will see it.
 */
export async function listTownHeroes(filters: HeroListFilters = {}): Promise<TownHeroView[]> {
  const viewerId = filters.viewerId ?? null;
  const take = Math.min(60, Math.max(1, filters.take ?? 30));
  const skip = (Math.max(1, filters.page ?? 1) - 1) * take;

  const visible: Prisma.TownHeroWhereInput[] = [{ status: "APPROVED" }];
  if (viewerId) visible.push({ nominatedByUserId: viewerId });

  const and: Prisma.TownHeroWhereInput[] = [{ OR: visible }];
  if (filters.countryId) {
    // A hero with no country belongs to everyone — the same rule
    // campaigns use, so a nomination made before countries were set
    // does not vanish from every list.
    and.push({ OR: [{ countryId: filters.countryId }, { countryId: null }] });
  }
  if (filters.categorySlug) {
    // By slug, not id: the URL carries the slug, and resolving it here
    // means a category page never needs a second round trip to find
    // out which id it is looking at.
    and.push({ category: { slug: filters.categorySlug.toLowerCase() } });
  }
  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { heroName: { contains: q } },
        { town: { contains: q } },
        { summary: { contains: q } },
      ],
    });
  }

  const rows = await prisma.townHero.findMany({
    where: { AND: and },
    select: CARD_SELECT,
    orderBy: [
      { isFeatured: "desc" },
      { featuredAt: "desc" },
      { approvedAt: "desc" },
      { createdAt: "desc" },
    ],
    skip,
    take,
  });

  const hearted = await heartsFor(viewerId, rows.map((r) => r.id));
  return rows.map((r) => shape(r, viewerId, hearted));
}

/**
 * One hero. Returns null rather than throwing for a slug nobody has,
 * so the page can render its own 404 instead of a stack trace.
 *
 * A PENDING or REJECTED hero is readable only by whoever nominated
 * them — otherwise a share link would leak an unreviewed nomination,
 * which is exactly what the review is for.
 */
export async function getTownHero(
  slug: string,
  viewerId: string | null,
): Promise<TownHeroView | null> {
  const row = await prisma.townHero.findUnique({
    where: { slug: slug.toLowerCase() },
    select: { ...CARD_SELECT, body: true },
  });
  if (!row) return null;
  if (row.status !== "APPROVED" && (!viewerId || row.nominatedByUserId !== viewerId)) return null;

  const hearted = await heartsFor(viewerId, [row.id]);
  return shape(row, viewerId, hearted);
}

/** For the home strip — approved only, never the viewer's pending ones. */
export async function listHeroHighlights(
  countryId: string | null,
  take = 6,
): Promise<TownHeroView[]> {
  const and: Prisma.TownHeroWhereInput[] = [{ status: "APPROVED" }];
  if (countryId) and.push({ OR: [{ countryId }, { countryId: null }] });

  const rows = await prisma.townHero.findMany({
    where: { AND: and },
    select: CARD_SELECT,
    orderBy: [{ isFeatured: "desc" }, { featuredAt: "desc" }, { approvedAt: "desc" }],
    take: Math.min(12, Math.max(1, take)),
  });
  return rows.map((r) => shape(r, null, new Set()));
}

/* ── nominating ──────────────────────────────────────────────── */

export class HeroRefused extends Error {}

export interface NominationInput {
  heroName: string;
  /** Required. The API resolves and validates it before we see it. */
  categoryId: string;
  town?: string | null;
  countryId?: string | null;
  photoUrl?: string | null;
  photoAlt?: string | null;
  summary?: string | null;
  body: string;
  isAnonymous?: boolean;
}

const trim = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

async function uniqueHeroSlug(base: string, excludeId?: string): Promise<string> {
  const raw = slugify(base) || "hero";
  // Shunted, not refused — somebody nominating a person called "New"
  // has done nothing wrong, and failing their submission to protect a
  // route would be a strange thing to explain.
  const root = RESERVED_HERO_SLUGS.has(raw) ? `${raw}-hero` : raw;
  let candidate = root;
  let n = 1;
  for (;;) {
    const clash = await prisma.townHero.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

/**
 * Nominate someone. Lands PENDING; nothing is public until reviewed.
 *
 * The banned-words masker runs here rather than at read time so a
 * moderator sees what the member will see, and the stored row is the
 * one that was approved.
 */
export async function nominateHero(
  nominator: { id: string; displayName: string },
  input: NominationInput,
): Promise<TownHeroView> {
  const heroName = trim(input.heroName, 120);
  if (!heroName) throw new HeroRefused("Who would you like to nominate?");
  const body = trim(input.body, 8000);
  if (!body || body.length < 20) {
    throw new HeroRefused("Tell us a little about what they do — a sentence or two is plenty.");
  }
  const categoryId = trim(input.categoryId, 40);
  if (!categoryId) throw new HeroRefused("Pick what kind of thing they do.");

  const mask = await getMasker();
  const slug = await uniqueHeroSlug(heroName);

  const row = await prisma.townHero.create({
    data: {
      slug,
      heroName: mask(heroName),
      town: trim(input.town, 120),
      countryId: trim(input.countryId, 40),
      photoUrl: trim(input.photoUrl, 500),
      photoAlt: trim(input.photoAlt, 300),
      summary: input.summary ? mask(trim(input.summary, 400) ?? "") : null,
      body: mask(body),
      categoryId,
      nominatedByUserId: nominator.id,
      nominatorSnapshot: nominator.displayName,
      isAnonymous: !!input.isAnonymous,
      status: "PENDING",
    },
    select: { ...CARD_SELECT, body: true },
  });
  return shape(row, nominator.id, new Set());
}

/** Hearts. Approved heroes only — you cannot applaud an unreviewed one. */
export async function toggleHeroHeart(
  userId: string,
  heroId: string,
): Promise<{ hearted: boolean; heartCount: number }> {
  const hero = await prisma.townHero.findUnique({
    where: { id: heroId },
    select: { status: true },
  });
  if (!hero || hero.status !== "APPROVED") throw new HeroRefused("This hero isn't available.");

  const key = { heroId_userId: { heroId, userId } };
  const existing = await prisma.townHeroHeart.findUnique({ where: key, select: { heroId: true } });

  if (existing) {
    const [, updated] = await prisma.$transaction([
      prisma.townHeroHeart.delete({ where: key }),
      prisma.townHero.update({
        where: { id: heroId },
        data: { heartCount: { decrement: 1 } },
        select: { heartCount: true },
      }),
    ]);
    return { hearted: false, heartCount: Math.max(0, updated.heartCount) };
  }

  const [, updated] = await prisma.$transaction([
    prisma.townHeroHeart.create({ data: { heroId, userId } }),
    prisma.townHero.update({
      where: { id: heroId },
      data: { heartCount: { increment: 1 } },
      select: { heartCount: true },
    }),
  ]);
  return { hearted: true, heartCount: Math.max(0, updated.heartCount) };
}

/* ── admin ───────────────────────────────────────────────────── */

export interface TownHeroAdminRow extends Omit<TownHeroView, "hearted" | "isOwn"> {
  body: string;
  /** The real name even when the nomination is anonymous. */
  nominatorRealName: string | null;
  nominatedByUserId: string | null;
  reviewedAt: string | null;
}

export async function listTownHeroesAdmin(opts: {
  status?: TownHeroStatus | "ALL";
  q?: string | null;
  take?: number;
} = {}): Promise<TownHeroAdminRow[]> {
  const take = Math.min(100, Math.max(1, opts.take ?? 50));
  const and: Prisma.TownHeroWhereInput[] = [];
  if (opts.status && opts.status !== "ALL") and.push({ status: opts.status });
  const q = opts.q?.trim();
  if (q) and.push({ OR: [{ heroName: { contains: q } }, { town: { contains: q } }] });

  const rows = await prisma.townHero.findMany({
    where: and.length ? { AND: and } : undefined,
    select: { ...CARD_SELECT, body: true, reviewedAt: true },
    // Oldest PENDING first: a queue is a queue, and the person who
    // has been waiting longest should not be at the bottom of it.
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take,
  });

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    heroName: r.heroName,
    town: r.town,
    countryId: r.countryId,
    photoUrl: r.photoUrl,
    photoAlt: r.photoAlt ?? "",
    summary: r.summary,
    category: r.category,
    body: r.body,
    nominatorName: r.isAnonymous ? null : (r.nominatorSnapshot ?? null),
    nominatorRealName: r.nominatorSnapshot ?? null,
    nominatedByUserId: r.nominatedByUserId,
    isAnonymous: r.isAnonymous,
    status: r.status,
    rejectionReason: r.rejectionReason,
    heartCount: Math.max(0, r.heartCount),
    isFeatured: r.isFeatured,
    approvedAt: r.approvedAt?.toISOString() ?? null,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Approve or reject, and tell whoever sent it.
 *
 * `approvedAt` is stamped only on the FIRST approval, like
 * `Article.publishedAt` — editing a hero and re-approving must not
 * shove them back to the top of the list ahead of newer nominations.
 */
export async function reviewTownHero(
  heroId: string,
  action: "approve" | "reject",
  adminId: string,
  reason?: string | null,
): Promise<{ status: TownHeroStatus }> {
  const hero = await prisma.townHero.findUnique({
    where: { id: heroId },
    select: { slug: true, heroName: true, approvedAt: true, nominatedByUserId: true },
  });
  if (!hero) throw new HeroRefused("That nomination is gone.");

  const status: TownHeroStatus = action === "approve" ? "APPROVED" : "REJECTED";
  const rejectionReason = action === "reject" ? trim(reason, 2000) : null;

  await prisma.townHero.update({
    where: { id: heroId },
    data: {
      status,
      rejectionReason,
      reviewedAt: new Date(),
      reviewedByAdminId: adminId,
      approvedAt: action === "approve" ? (hero.approvedAt ?? new Date()) : hero.approvedAt,
    },
  });

  if (hero.nominatedByUserId) {
    await createUserNotification({
      userId: hero.nominatedByUserId,
      type: action === "approve" ? "TOWN_HERO_APPROVED" : "TOWN_HERO_REJECTED",
      title: action === "approve" ? "Your nomination is up" : "Your nomination wasn't published",
      body:
        action === "approve"
          ? `${hero.heroName} is on the Town Heroes page.`
          : rejectionReason
            ? `Reason: ${rejectionReason}`
            : "A moderator wasn't able to publish this one.",
      actionUrl: action === "approve" ? `/town-heroes/${hero.slug}` : "/town-heroes",
    }).catch(() => {});
  }

  return { status };
}

export interface HeroEditInput extends Partial<NominationInput> {
  isFeatured?: boolean;
}

/** An admin tidying a nomination up before it goes out. */
export async function updateTownHero(heroId: string, input: HeroEditInput): Promise<void> {
  const current = await prisma.townHero.findUnique({
    where: { id: heroId },
    select: { heroName: true, isFeatured: true },
  });
  if (!current) throw new HeroRefused("That nomination is gone.");

  const data: Prisma.TownHeroUpdateInput = {};
  const heroName = trim(input.heroName, 120);
  if (heroName) {
    data.heroName = heroName;
    // Renaming re-slugs, so a corrected spelling doesn't leave the
    // old one in the URL forever.
    if (heroName !== current.heroName) data.slug = await uniqueHeroSlug(heroName, heroId);
  }
  if (input.town !== undefined) data.town = trim(input.town, 120);
  if (input.categoryId !== undefined) {
    // Move it, never un-file it: the column is required, so an empty
    // value here is a no-op rather than a disconnect.
    const id = trim(input.categoryId, 40);
    if (id) data.category = { connect: { id } };
  }
  if (input.countryId !== undefined) data.countryId = trim(input.countryId, 40);
  if (input.photoUrl !== undefined) data.photoUrl = trim(input.photoUrl, 500);
  if (input.photoAlt !== undefined) data.photoAlt = trim(input.photoAlt, 300);
  if (input.summary !== undefined) data.summary = trim(input.summary, 400);
  const body = trim(input.body, 8000);
  if (body) data.body = body;
  if (input.isFeatured !== undefined && input.isFeatured !== current.isFeatured) {
    data.isFeatured = input.isFeatured;
    // Stamped only on the false→true flip, so re-saving a featured
    // hero doesn't keep pushing them above the others.
    data.featuredAt = input.isFeatured ? new Date() : null;
  }

  if (Object.keys(data).length) await prisma.townHero.update({ where: { id: heroId }, data });
}

export async function deleteTownHero(heroId: string): Promise<void> {
  await prisma.townHero.delete({ where: { id: heroId } });
}
