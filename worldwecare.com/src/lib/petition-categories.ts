/**
 * Petition categories — what a petition is ABOUT.
 *
 * Deliberately not the same list as events or live: a petition is
 * aimed at a body that can say yes, so the categories are the areas
 * those bodies have departments for. See the model's own comment.
 *
 * THE COUNTS ARE OF OPEN PETITIONS, NOT ALL OF THEM. A tile reading
 * "Transport · 14" made entirely of petitions that closed last spring
 * promises something to sign that is not there. A closed petition
 * keeps its category and its page — that record is the point of
 * having run it — it just does not count towards the tile.
 *
 * A petition with a deadline in the past is closed without anyone
 * acting on it; that rule lives in `isOpen` in petitions.ts and is
 * mirrored here as a where clause, because a count cannot call a
 * function per row. The two must agree — if you change one, change
 * both, and `openPetitionWhere` below is the shared piece.
 *
 * Admin-managed and closed, like every other taxonomy here. The list
 * is currently seeded (prisma/seed-petition-categories.ts); retiring
 * one means `isActive = false`, which takes it off the picker and the
 * tiles while the petitions already filed under it keep their label.
 */

import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

export interface PublicPetitionCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  /** Approved and still taking signatures — what the tile counts. */
  openCount: number;
}

/**
 * The one definition of "still taking signatures", as a query.
 *
 * Kept here rather than inlined at each call site because it is the
 * rule the tile's number and the category page's list have to agree
 * on: a tile saying 3 over a page showing none is the filter lying
 * about itself.
 */
export function openPetitionWhere(now = new Date()): Prisma.PetitionWhereInput {
  return {
    status: "APPROVED",
    OR: [{ closesAt: null }, { closesAt: { gt: now } }],
  };
}

/**
 * Active categories, with how many open petitions each holds.
 *
 * EMPTY ONES ARE STILL RETURNED, and that is the whole reason this
 * exists before anyone has started a petition. The tiles are what tell
 * a visitor the sort of thing this place is for — "Housing · Nothing
 * yet" is a prompt, and it is the one tile a reader can actually do
 * something about. A grid that showed only categories in use would be
 * blank on day one, which is the state it most needs to be useful in.
 *
 * `countryId` narrows the counts to the list the viewer is actually
 * looking at, for the same reason.
 */
export async function listPublicCategories(
  opts: { countryId?: string | null } = {},
): Promise<PublicPetitionCategory[]> {
  const [cats, counts] = await Promise.all([
    prisma.petitionCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, slug: true, description: true, emoji: true, color: true,
      },
    }),
    prisma.petition.groupBy({
      by: ["categoryId"],
      where: {
        ...openPetitionWhere(),
        categoryId: { not: null },
        ...(opts.countryId ? { countryId: opts.countryId } : {}),
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
  return cats.map((c) => ({ ...c, openCount: by.get(c.id) ?? 0 }));
}

/**
 * One category by slug, for its page.
 *
 * Deliberately does NOT check `isActive`. A retired category still
 * has petitions filed under it and links to it in the wild; the page
 * keeps working, it just stops being offered on new ones.
 */
export async function getCategoryBySlug(slug: string) {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  return prisma.petitionCategory.findUnique({
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
 * Is this a category a petition may currently be filed under?
 *
 * The id arrives from a form, so it is checked rather than trusted: it
 * must exist AND be active. Filing into a retired category through a
 * stale page would put a petition somewhere nobody is looking.
 */
export async function isSelectableCategory(id: string | null | undefined): Promise<boolean> {
  if (!id) return false;
  const row = await prisma.petitionCategory.findFirst({
    where: { id, isActive: true },
    select: { id: true },
  });
  return !!row;
}
