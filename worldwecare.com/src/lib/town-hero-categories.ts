/**
 * Town Hero categories — what KIND of quiet work this is.
 *
 * Mirrors `event-categories.ts` and `live-categories.ts` on purpose:
 * admin-managed, closed, retired rather than deleted, and the counts
 * are of things a reader can actually see.
 *
 * THE COUNTS ARE OF APPROVED HEROES ONLY. A tile reading "Food banks
 * 12" made partly of nominations still sitting in the review queue
 * promises a page that isn't there yet, and quietly tells the world
 * how many unreviewed nominations exist — which is nobody's business.
 * A member's own pending nomination is visible to THEM on the list;
 * it is not counted here.
 *
 * EMPTY CATEGORIES ARE STILL RETURNED. Same reasoning as the article
 * tiles: on a page whose whole job is to invite nominations, a
 * category with nobody in it is the most useful tile on the screen.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { slugify } from "./geography-admin";

export interface HeroCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  /** Every hero ever filed under it — the admin's "is this used?" number. */
  heroCount: number;
  /** Approved and visible — what the tiles count. */
  publicCount: number;
}

export interface PublicHeroCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  publicCount: number;
}

/**
 * `category` is the static segment of /town-heroes/category/[slug],
 * and `new` is the nominate page — both sit beside /town-heroes/[slug]
 * and Next resolves static first, so a category slugged either would
 * be permanently unreachable. Shunted, not refused.
 */
const RESERVED_CATEGORY_SLUGS = new Set(["all", "category", "new", "nominate"]);

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const raw = slugify(base) || "category";
  const root = RESERVED_CATEGORY_SLUGS.has(raw) ? `${raw}-heroes` : raw;
  let candidate = root;
  let n = 1;
  for (;;) {
    const clash = await prisma.townHeroCategory.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

/* ── reading ─────────────────────────────────────────────────── */

/**
 * Active categories with their approved-hero counts, narrowed to a
 * country when one is picked — so a tile's number matches the number
 * of people the reader will actually find behind it.
 */
export async function listPublicHeroCategories(
  countryId?: string | null,
): Promise<PublicHeroCategory[]> {
  const cats = await prisma.townHeroCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, description: true, emoji: true, color: true },
  });
  if (!cats.length) return [];

  const where: Prisma.TownHeroWhereInput = {
    status: "APPROVED",
    categoryId: { in: cats.map((c) => c.id) },
    ...(countryId ? { OR: [{ countryId }, { countryId: null }] } : {}),
  };
  const counts = await prisma.townHero.groupBy({
    by: ["categoryId"],
    where,
    _count: { _all: true },
  });
  const byId = new Map(counts.map((c) => [c.categoryId, c._count._all]));

  return cats.map((c) => ({ ...c, publicCount: byId.get(c.id) ?? 0 }));
}

export async function getHeroCategoryBySlug(
  slug: string,
  countryId?: string | null,
): Promise<PublicHeroCategory | null> {
  const all = await listPublicHeroCategories(countryId);
  const want = slug.toLowerCase();
  return all.find((c) => c.slug === want) ?? null;
}

/* ── admin ───────────────────────────────────────────────────── */

/** Only `#abc` and `#aabbcc` — this lands in an inline style. */
function cleanColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : null;
}

/** One codepoint, so a pasted string can't become the whole tile. */
function cleanEmoji(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const first = [...raw.trim()][0];
  return first ?? null;
}

export async function listHeroCategoriesAdmin(): Promise<HeroCategoryRow[]> {
  const cats = await prisma.townHeroCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  if (!cats.length) return [];

  const [all, approved] = await Promise.all([
    prisma.townHero.groupBy({
      by: ["categoryId"],
      where: { categoryId: { in: cats.map((c) => c.id) } },
      _count: { _all: true },
    }),
    prisma.townHero.groupBy({
      by: ["categoryId"],
      where: { categoryId: { in: cats.map((c) => c.id) }, status: "APPROVED" },
      _count: { _all: true },
    }),
  ]);
  const allById = new Map(all.map((c) => [c.categoryId, c._count._all]));
  const okById = new Map(approved.map((c) => [c.categoryId, c._count._all]));

  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    emoji: c.emoji,
    color: c.color,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    heroCount: allById.get(c.id) ?? 0,
    publicCount: okById.get(c.id) ?? 0,
  }));
}

export interface HeroCategoryInput {
  name?: string;
  description?: string | null;
  emoji?: string | null;
  color?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export async function createHeroCategory(input: HeroCategoryInput): Promise<{ id: string }> {
  const name = input.name?.trim();
  if (!name) throw new Error("A category needs a name.");
  return prisma.townHeroCategory.create({
    data: {
      name: name.slice(0, 80),
      slug: await uniqueSlug(name),
      description: input.description?.trim().slice(0, 300) || null,
      emoji: cleanEmoji(input.emoji),
      color: cleanColor(input.color),
      sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0,
      isActive: input.isActive ?? true,
    },
    select: { id: true },
  });
}

export async function updateHeroCategory(id: string, input: HeroCategoryInput): Promise<void> {
  const data: Prisma.TownHeroCategoryUpdateInput = {};
  const name = input.name?.trim();
  if (name) {
    data.name = name.slice(0, 80);
    data.slug = await uniqueSlug(name, id);
  }
  if (input.description !== undefined) data.description = input.description?.trim().slice(0, 300) || null;
  if (input.emoji !== undefined) data.emoji = cleanEmoji(input.emoji);
  if (input.color !== undefined) data.color = cleanColor(input.color);
  if (input.sortOrder !== undefined && Number.isFinite(input.sortOrder)) {
    data.sortOrder = Number(input.sortOrder);
  }
  if (input.isActive !== undefined) data.isActive = !!input.isActive;
  if (Object.keys(data).length) await prisma.townHeroCategory.update({ where: { id }, data });
}

/**
 * Deleting is allowed only while nothing is filed under it. A category
 * in use is retired instead — `onDelete: SetNull` would otherwise
 * quietly strip the label off every hero in it, which is a strange
 * thing to have happen because somebody tidied a settings screen.
 */
export async function deleteHeroCategory(id: string): Promise<void> {
  const used = await prisma.townHero.count({ where: { categoryId: id } });
  if (used > 0) {
    throw new Error(
      `${used} ${used === 1 ? "hero is" : "heroes are"} filed under this. Turn it off instead.`,
    );
  }
  await prisma.townHeroCategory.delete({ where: { id } });
}

/** Unknown or retired ids become null rather than an error. */
export async function validHeroCategoryId(raw: unknown): Promise<string | null> {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const row = await prisma.townHeroCategory.findFirst({
    where: { id: raw, isActive: true },
    select: { id: true },
  });
  return row?.id ?? null;
}
