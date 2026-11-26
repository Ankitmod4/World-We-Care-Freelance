/**
 * Categories for the gratitude wall.
 *
 * ONE KIND NOW, AND `kind` IS STILL THERE. This module carried two
 * tables — confessions and gratitude — and every operation branched on
 * which. The confession wall is gone, so each branch collapsed to its
 * gratitude half.
 *
 * The `kind` parameter stayed rather than being ripped out of forty
 * call sites for no behavioural gain. It is a single-member union, so
 * TypeScript still rejects anything else, and the day a second kind of
 * wall arrives the branches go back where they were.
 *
 * WHY DEACTIVATE RATHER THAN DELETE. A category with a hundred
 * entries under it is not really deletable: `SetNull` on the
 * relation means deleting it silently un-categorises all hundred, with
 * no way back. `isActive: false` removes it from the composer and the
 * filter row while leaving those posts exactly where they are. Delete
 * stays available for the genuine mistake — a typo created a minute
 * ago — and says how many posts it will orphan before it happens.
 */

import { prisma } from "./db";

export type CategoryKind = "gratitude";

export interface CategoryInput {
  name: string;
  description?: string | null;
  emoji?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  sortOrder: number;
  isActive: boolean;
  /** How many posts sit under it. Read-only, and the reason delete
   *  asks twice. */
  count: number;
}

/* ── the one difference between the two ──────────────────────── */

/** Narrow, identical result shapes, so the ternaries below type. */
type IdRow = { id: string } | null;

function byId(kind: CategoryKind, id: string, activeOnly = false): Promise<IdRow> {
  const where = activeOnly ? { id, isActive: true } : { id };
  return prisma.gratitudeCategory.findFirst({ where, select: { id: true } });
}

function bySlug(kind: CategoryKind, slug: string): Promise<IdRow> {
  return prisma.gratitudeCategory.findUnique({ where: { slug }, select: { id: true } });
}

function slugClash(kind: CategoryKind, slug: string, excludeId?: string): Promise<IdRow> {
  const where = { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) };
  return prisma.gratitudeCategory.findFirst({ where, select: { id: true } });
}

interface WriteData {
  name?: string;
  slug?: string;
  description?: string | null;
  emoji?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

function insert(kind: CategoryKind, data: WriteData & { name: string; slug: string }) {
  return prisma.gratitudeCategory.create({ data, select: { id: true, slug: true } });
}

async function patch(kind: CategoryKind, id: string, data: WriteData): Promise<void> {
  await prisma.gratitudeCategory.update({ where: { id }, data });
}

async function drop(kind: CategoryKind, id: string): Promise<void> {
  await prisma.gratitudeCategory.delete({ where: { id } });
}

/**
 * How many posts sit under one category.
 *
 * Counted from the post side rather than grouped, because it is only
 * ever asked about a single category — before deleting one. The list
 * gets its counts from the relation instead (see `listCategories`),
 * which is one query for all of them.
 */
async function countFor(kind: CategoryKind, categoryId: string): Promise<number> {
  return prisma.gratitudeEntry.count({ where: { categoryId } });
}

/* ── reading ─────────────────────────────────────────────────── */

/**
 * Every category, active or not, with post counts. Admin only — the
 * public side never wants the retired ones.
 */
export async function listCategories(kind: CategoryKind): Promise<CategoryRow[]> {
  const order = [{ sortOrder: "asc" as const }, { name: "asc" as const }];

  const rows = await prisma.gratitudeCategory.findMany({
    orderBy: order,
    include: { _count: { select: { entries: true } } },
  });
  return rows.map((r) => ({ ...shared(r), count: r._count.entries }));
}

/** The fields both tables have, in one place. */
function shared(r: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  sortOrder: number;
  isActive: boolean;
}): Omit<CategoryRow, "count"> {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    emoji: r.emoji,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
  };
}

/**
 * What the composer and the filter row show: active only, and only
 * the fields a chip needs.
 */
export async function listPublicCategories(kind: CategoryKind) {
  const args = {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" as const }, { name: "asc" as const }],
    select: { id: true, name: true, slug: true, emoji: true },
  };
  return prisma.gratitudeCategory.findMany(args);
}

/**
 * Are there any categories to choose from?
 *
 * Asked before rejecting a post for having no category. A community
 * whose admin has not made any categories yet — or has retired the
 * last one — must still be able to post; requiring a choice from an
 * empty list would silently close the wall. So the rule is not
 * "every post has a category", it is "every post has a category IF
 * there is one to pick", and this is the second half of that.
 */
export async function hasCategories(kind: CategoryKind): Promise<boolean> {
  const where = { isActive: true };
  const n = await prisma.gratitudeCategory.count({ where });
  return n > 0;
}

/** Resolve a slug from a URL to an id, or null if it isn't one. */
export async function categoryIdForSlug(
  kind: CategoryKind,
  slug: string | null | undefined,
): Promise<string | null> {
  if (!slug) return null;
  return (await bySlug(kind, slug))?.id ?? null;
}

/**
 * Check a category id submitted with a post.
 *
 * The id comes from a form, so it gets checked: it must exist, and it
 * must be active. Posting into a retired category through a stale page
 * would resurrect it on the filter row.
 */
export async function validCategoryId(
  kind: CategoryKind,
  id: unknown,
): Promise<string | null> {
  if (typeof id !== "string" || !id.trim()) return null;
  return (await byId(kind, id.trim(), true))?.id ?? null;
}

/* ── writing ─────────────────────────────────────────────────── */

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

async function uniqueSlug(
  kind: CategoryKind,
  base: string,
  excludeId?: string,
): Promise<string> {
  const root = slugify(base) || "category";
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await slugClash(kind, candidate, excludeId);
    if (!clash) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

function cleanName(name: string): string {
  const t = name.trim().slice(0, 60);
  if (!t) throw new Error("Give the category a name.");
  return t;
}

export async function createCategory(kind: CategoryKind, input: CategoryInput) {
  const name = cleanName(input.name);
  return insert(kind, {
    name,
    slug: await uniqueSlug(kind, name),
    description: input.description?.trim().slice(0, 500) || null,
    // One or two characters. A "category emoji" holding a paragraph is
    // someone using the wrong field.
    emoji: input.emoji?.trim().slice(0, 8) || null,
    sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0,
    isActive: input.isActive ?? true,
  });
}

export async function updateCategory(
  kind: CategoryKind,
  id: string,
  input: Partial<CategoryInput>,
) {
  const data: WriteData = {};
  if (input.name !== undefined) {
    const name = cleanName(input.name);
    data.name = name;
    // The slug follows the name. Categories are reached by id
    // everywhere internal, and the slug only appears in a filter URL,
    // so a rename changing it costs a stale bookmark at worst.
    data.slug = await uniqueSlug(kind, name, id);
  }
  if (input.description !== undefined) {
    data.description = input.description?.trim().slice(0, 500) || null;
  }
  if (input.emoji !== undefined) data.emoji = input.emoji?.trim().slice(0, 8) || null;
  if (input.sortOrder !== undefined && Number.isFinite(input.sortOrder)) {
    data.sortOrder = Number(input.sortOrder);
  }
  if (input.isActive !== undefined) data.isActive = input.isActive === true;

  if (Object.keys(data).length === 0) return;
  await patch(kind, id, data);
}

/**
 * Delete, and say what it cost.
 *
 * The relation is SetNull, so the posts survive and become
 * uncategorised. That is recoverable only by someone re-filing them by
 * hand, which is why the admin UI shows the count first and why this
 * returns it.
 */
export async function deleteCategory(
  kind: CategoryKind,
  id: string,
): Promise<{ orphaned: number }> {
  // Counted BEFORE the delete. Afterwards the rows have already been
  // set to null and there is nothing left to count.
  const orphaned = await countFor(kind, id);
  await drop(kind, id);
  return { orphaned };
}

/* ── category tiles ─────────────────────────────────────────── */

export interface CategoryTile {
  id: string;
  name: string;
  slug: string;
  emoji: string | null;
  description: string | null;
  /** APPROVED entries only — the count a reader can actually go and see. */
  count: number;
}

/**
 * The categories, with a count, for the tile grid on a wall.
 *
 * EMPTY CATEGORIES ARE KEPT. Same call the Town Heroes tiles make and
 * for the same reason: on a page whose job is to prompt somebody to
 * write, a tile reading "Relapse · Nothing yet" tells a reader exactly
 * what this place is for and is the one tile they can do something
 * about. Hiding it would leave the wall looking narrower than it is.
 *
 * THE COUNT IS OF APPROVED ROWS ONLY. Both walls are moderated, and a
 * tile promising four entries that opens onto one is worse than a tile
 * that says one.
 */
export async function listCategoryTiles(kind: CategoryKind): Promise<CategoryTile[]> {
  const args = {
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" as const }, { name: "asc" as const }],
    select: {
      id: true,
      name: true,
      slug: true,
      emoji: true,
      description: true,
      _count: { select: { entries: { where: { status: "APPROVED" as const } } } },
    },
  };

  const rows = await prisma.gratitudeCategory.findMany(args);
  return rows.map((r) => ({
    id: r.id, name: r.name, slug: r.slug, emoji: r.emoji,
    description: r.description, count: r._count.entries,
  }));
}

/**
 * One category by its slug, or null.
 *
 * `isActive` is deliberately NOT checked. A retired category still has
 * entries filed under it, and its page has to keep working — the
 * retirement stops it being OFFERED, it does not delete what people
 * wrote. The tiles use `listCategoryTiles`, which does filter, so a
 * retired one simply stops being linked to.
 */
export async function getCategoryBySlug(
  kind: CategoryKind,
  slug: string,
): Promise<{ id: string; name: string; slug: string; emoji: string | null; description: string | null } | null> {
  const args = {
    where: { slug },
    select: { id: true, name: true, slug: true, emoji: true, description: true },
  };
  return prisma.gratitudeCategory.findUnique(args);
}
