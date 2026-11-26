/**
 * Live-stream categories — the taxonomy a broadcaster picks from and
 * viewers browse by.
 *
 * Admin-managed, exactly like chat categories: created, renamed,
 * reordered and retired from /admin/live/categories. Nothing here
 * invents a category on the fly, because a taxonomy that anyone can
 * extend mid-broadcast stops being a taxonomy.
 *
 * Retiring (isActive=false) rather than deleting is the intended way
 * to remove one: it disappears from the picker and the filter chips
 * while the broadcasts already filed under it keep their label.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { slugify } from "./geography-admin";

export interface LiveCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  /** Broadcasts filed under it, ever — the admin's "is this used?" number. */
  streamCount: number;
  /** Public and LIVE right now — what the browse chips count. */
  liveCount: number;
}

/** Shape the picker and the filter chips consume. */
export interface PublicLiveCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  /** Broadcasts on air in this category right now. */
  liveCount: number;
  /** People watching across those broadcasts, summed. */
  viewerCount: number;
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "category";
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await prisma.liveCategory.findFirst({
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
 * Active categories with a count of what's live in each.
 *
 * Categories with nothing live are still returned. A filter row that
 * only shows categories currently in use would flicker as broadcasts
 * start and end, and would hide the taxonomy from someone deciding
 * what to stream.
 */
export async function listPublicCategories(): Promise<PublicLiveCategory[]> {
  const [cats, counts] = await Promise.all([
    prisma.liveCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        emoji: true,
        color: true,
      },
    }),
    // One grouped count beats N per-category counts, and matches the
    // exact predicate listLive() uses so the chip never disagrees with
    // the grid underneath it.
    prisma.liveStream.groupBy({
      by: ["categoryId"],
      where: { visibility: "PUBLIC", status: "LIVE", categoryId: { not: null } },
      _count: { _all: true },
      // Summed in the same pass — "3 live" and "47 watching" answer two
      // different questions, and a second query for the second number
      // would let the two disagree.
      _sum: { viewerCount: true },
    }),
  ]);

  const liveBy = new Map<string, number>();
  const viewersBy = new Map<string, number>();
  for (const row of counts) {
    if (!row.categoryId) continue;
    liveBy.set(row.categoryId, row._count._all);
    viewersBy.set(row.categoryId, row._sum.viewerCount ?? 0);
  }

  return cats.map((c) => ({
    ...c,
    liveCount: liveBy.get(c.id) ?? 0,
    viewerCount: viewersBy.get(c.id) ?? 0,
  }));
}

/** Resolve a slug to an active category id, or null. */
export async function categoryIdForSlug(slug: string): Promise<string | null> {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  const row = await prisma.liveCategory.findFirst({
    where: { slug: clean, isActive: true },
    select: { id: true },
  });
  return row?.id ?? null;
}

/* ── admin ───────────────────────────────────────────────────── */

export async function listCategories(): Promise<LiveCategoryRow[]> {
  const [rows, live] = await Promise.all([
    prisma.liveCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { streams: true } } },
    }),
    prisma.liveStream.groupBy({
      by: ["categoryId"],
      where: { status: "LIVE", categoryId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const liveBy = new Map<string, number>();
  for (const row of live) {
    if (row.categoryId) liveBy.set(row.categoryId, row._count._all);
  }
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    emoji: c.emoji,
    color: c.color,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    streamCount: c._count.streams,
    liveCount: liveBy.get(c.id) ?? 0,
  }));
}

export interface CategoryInput {
  name: string;
  description?: string | null;
  emoji?: string | null;
  color?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

/** Accept "#abc" / "#aabbcc" only — this lands in an inline style. */
function cleanColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;
  return /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null;
}

function cleanEmoji(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return v ? Array.from(v)[0] ?? null : null;
}

export async function createCategory(input: CategoryInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  if (name.length > 80) throw new Error("Keep the name under 80 characters.");
  return prisma.liveCategory.create({
    data: {
      name,
      slug: await uniqueSlug(name),
      description: input.description?.trim()?.slice(0, 300) || null,
      emoji: cleanEmoji(input.emoji),
      color: cleanColor(input.color),
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updateCategory(id: string, input: Partial<CategoryInput>) {
  const data: Prisma.LiveCategoryUpdateInput = {};
  if (typeof input.name === "string") {
    const name = input.name.trim();
    if (!name) throw new Error("Name is required.");
    if (name.length > 80) throw new Error("Keep the name under 80 characters.");
    data.name = name;
    // The slug is part of shareable /live?category= links, so it only
    // moves when the name it was derived from actually changes.
    const current = await prisma.liveCategory.findUnique({
      where: { id },
      select: { name: true },
    });
    if (current && current.name !== name) data.slug = await uniqueSlug(name, id);
  }
  if (input.description !== undefined) {
    data.description = input.description?.trim()?.slice(0, 300) || null;
  }
  if (input.emoji !== undefined) data.emoji = cleanEmoji(input.emoji);
  if (input.color !== undefined) data.color = cleanColor(input.color);
  if (typeof input.sortOrder === "number") data.sortOrder = input.sortOrder;
  if (typeof input.isActive === "boolean") data.isActive = input.isActive;
  return prisma.liveCategory.update({ where: { id }, data });
}

/**
 * Delete a category outright.
 *
 * Refused while broadcasts still reference it. The FK is SetNull, so
 * deleting wouldn't lose the streams — it would quietly strip their
 * category, which is a surprising outcome for a button labelled
 * "delete". Retiring is the intended path and the error says so.
 */
export async function deleteCategory(id: string) {
  const used = await prisma.liveStream.count({ where: { categoryId: id } });
  if (used > 0) {
    throw new Error(
      `${used} broadcast${used === 1 ? "" : "s"} still use this category. Retire it instead, or move them first.`,
    );
  }
  await prisma.liveCategory.delete({ where: { id } });
}
