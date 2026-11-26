/**
 * Campaign categories — what a campaign is ORGANISED AROUND.
 *
 * Deliberately not the same table as petitions, even though the two
 * lists read alike at a glance. A petition is aimed at a body that can
 * say yes, so its categories are the areas those bodies have
 * departments for. A campaign is a thing people organise around, which
 * is a different cut of the same world: "Loneliness & connection" is
 * something to organise around and nothing to petition anyone about.
 * Sharing one table would also mean retiring a category in one section
 * silently retired it in the other.
 *
 * THE COUNTS ARE OF LIVE CAMPAIGNS, NOT ALL OF THEM. A tile reading
 * "Housing · 9" made of campaigns that all ended last spring promises
 * something to join that is not there. A finished campaign keeps its
 * category and its page — that record is worth having — it just does
 * not count towards the tile.
 *
 * "Finished" is `endsAt` in the past, which is the same rule
 * `isFinished` applies per row in campaigns.ts. A count cannot call a
 * function per row, so it is mirrored here as a where clause. THE TWO
 * MUST AGREE: change one, change both, and `liveCampaignWhere` below
 * is the shared piece.
 *
 * Admin-managed and closed, like every other taxonomy here. The list
 * is seeded (prisma/seed-campaign-categories.ts); retiring one means
 * `isActive = false`, which takes it off the picker and the tiles
 * while the campaigns already filed under it keep their label.
 */

import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

export interface PublicCampaignCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  /** Published and not past its end date — what the tile counts. */
  liveCount: number;
}

/**
 * The one definition of "a campaign you can still join", as a query.
 *
 * Kept here rather than inlined at each call site because it is the
 * rule the tile's number and the category page's list have to agree
 * on: a tile saying 3 over a page showing none is the filter lying
 * about itself.
 */
export function liveCampaignWhere(now = new Date()): Prisma.CampaignWhereInput {
  return {
    status: "PUBLISHED",
    OR: [{ endsAt: null }, { endsAt: { gt: now } }],
  };
}

/**
 * Active categories, with how many live campaigns each holds.
 *
 * EMPTY ONES ARE STILL RETURNED, and that is the whole reason this
 * exists before anyone has started a campaign. The tiles are what tell
 * a visitor the sort of thing this place is for — "Housing &
 * homelessness · Nothing yet" is a prompt, and it is the one tile a
 * reader can actually do something about now that they can submit one.
 * A grid that showed only categories in use would be blank on day one,
 * which is the state it most needs to be useful in.
 *
 * `countryId` narrows the counts to the list the viewer is actually
 * looking at, for the same reason.
 */
export async function listPublicCategories(
  opts: { countryId?: string | null } = {},
): Promise<PublicCampaignCategory[]> {
  const [cats, counts] = await Promise.all([
    prisma.campaignCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, slug: true, description: true, emoji: true, color: true,
      },
    }),
    prisma.campaign.groupBy({
      by: ["categoryId"],
      where: {
        ...liveCampaignWhere(),
        categoryId: { not: null },
        // A campaign with no country belongs to everyone, so it counts
        // wherever the reader is standing. Same rule as listCampaigns.
        ...(opts.countryId
          ? { OR: [{ countryId: opts.countryId }, { countryId: null }] }
          : {}),
      },
      _count: { _all: true },
      // Prisma requires an orderBy on a grouped aggregate; this one is
      // never read, the result is keyed into a Map below.
      orderBy: { _count: { categoryId: "desc" } },
    }),
  ]);

  const by = new Map<string, number>();
  for (const row of counts) {
    if (row.categoryId) by.set(row.categoryId, row._count._all);
  }
  return cats.map((c) => ({ ...c, liveCount: by.get(c.id) ?? 0 }));
}

/**
 * One category by slug, for its page.
 *
 * Deliberately does NOT check `isActive`. A retired category still has
 * campaigns filed under it and links to it in the wild; the page keeps
 * working, it just stops being offered on new ones.
 */
export async function getCategoryBySlug(slug: string) {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  return prisma.campaignCategory.findUnique({
    where: { slug: clean },
    select: { id: true, name: true, slug: true, description: true, emoji: true, color: true },
  });
}

/** Resolve a ?category= slug for the list API. Null for unknown. */
export async function categoryIdForSlug(slug: string | null | undefined): Promise<string | null> {
  if (!slug) return null;
  return (await getCategoryBySlug(slug))?.id ?? null;
}

/**
 * Is this a category a campaign may currently be filed under?
 *
 * The id arrives from a form, so it is checked rather than trusted: it
 * must exist AND be active. Filing into a retired category through a
 * stale page would put a campaign somewhere nobody is looking.
 */
export async function isSelectableCategory(id: string | null | undefined): Promise<boolean> {
  if (!id) return false;
  const row = await prisma.campaignCategory.findFirst({
    where: { id, isActive: true },
    select: { id: true },
  });
  return !!row;
}

/**
 * The picker's list: id and name only, active ones, in display order.
 *
 * Separate from `listPublicCategories` because a form has no use for
 * the counts and should not make the campaign table do a groupBy every
 * time somebody opens it.
 */
export async function listSelectableCategories() {
  return prisma.campaignCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, emoji: true },
  });
}
