/**
 * Event categories — what a gathering IS, so an empty calendar still
 * says what this place does.
 *
 * Admin-managed and deliberately closed, the same as live and chat
 * categories: nothing here invents one on the fly, because a taxonomy
 * anyone can extend at submit time stops being a taxonomy.
 *
 * THE COUNTS ARE OF UPCOMING EVENTS, NOT ALL OF THEM. A chip reading
 * "Fundraisers 40" made entirely of things that happened last year is
 * worse than one reading "Fundraisers" — it promises a calendar that
 * isn't there. Past events keep their category; they just don't count
 * towards the number on the chip.
 *
 * Retiring (isActive=false) rather than deleting is how to remove one:
 * it leaves the picker and the chips while events already filed under
 * it keep their label.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { slugify } from "./geography-admin";

export interface EventCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  /** Events filed under it, ever — the admin's "is this used?" number. */
  eventCount: number;
  /** Approved and still to come — what the chips count. */
  upcomingCount: number;
}

/** Shape the picker and the filter chips consume. */
export interface PublicEventCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  upcomingCount: number;
}

/**
 * "all" is the /events/category/all route — the whole calendar. A
 * category slugged the same would be permanently unreachable, so it is
 * shunted rather than refused: an admin naming a category "All" has
 * done nothing wrong.
 */
const RESERVED_CATEGORY_SLUGS = new Set(["all", "category", "new"]);

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const raw = slugify(base) || "category";
  const root = RESERVED_CATEGORY_SLUGS.has(raw) ? `${raw}-events` : raw;
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await prisma.eventCategory.findFirst({
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
 * Active categories, with how many upcoming events each holds.
 *
 * Empty ones are still returned, and that is the entire point of this
 * function existing before anyone has posted anything: the chips are
 * what tell a visitor the sort of thing that happens here. A row that
 * showed only categories currently in use would be blank on day one,
 * which is the state it most needs to be useful in.
 *
 * `countryId` narrows the counts to the calendar the viewer is
 * actually looking at — a chip saying 12 over a page showing none is
 * the country filter lying about itself.
 */
export async function listPublicCategories(
  opts: { countryId?: string | null } = {},
): Promise<PublicEventCategory[]> {
  const [cats, counts] = await Promise.all([
    prisma.eventCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, slug: true, description: true, emoji: true, color: true,
      },
    }),
    prisma.event.groupBy({
      by: ["categoryId"],
      where: {
        status: "APPROVED",
        startsAt: { gte: new Date() },
        categoryId: { not: null },
        ...(opts.countryId ? { countryId: opts.countryId } : {}),
      },
      _count: { _all: true },
    }),
  ]);

  const by = new Map<string, number>();
  for (const row of counts) {
    if (row.categoryId) by.set(row.categoryId, row._count._all);
  }
  return cats.map((c) => ({ ...c, upcomingCount: by.get(c.id) ?? 0 }));
}

/** Resolve a ?category= slug. Null for unknown or retired. */
export async function categoryIdForSlug(slug: string): Promise<string | null> {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  const row = await prisma.eventCategory.findFirst({
    where: { slug: clean, isActive: true },
    select: { id: true },
  });
  return row?.id ?? null;
}

/** Is this a category an event may currently be filed under? */
export async function isSelectableCategory(id: string): Promise<boolean> {
  if (!id) return false;
  const row = await prisma.eventCategory.findFirst({
    where: { id, isActive: true },
    select: { id: true },
  });
  return !!row;
}

/* ── admin ───────────────────────────────────────────────────── */

export async function listCategories(): Promise<EventCategoryRow[]> {
  const [rows, upcoming] = await Promise.all([
    prisma.eventCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { events: true } } },
    }),
    prisma.event.groupBy({
      by: ["categoryId"],
      where: { status: "APPROVED", startsAt: { gte: new Date() }, categoryId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const by = new Map<string, number>();
  for (const row of upcoming) {
    if (row.categoryId) by.set(row.categoryId, row._count._all);
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
    eventCount: c._count.events,
    upcomingCount: by.get(c.id) ?? 0,
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
  return prisma.eventCategory.create({
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
  const data: Prisma.EventCategoryUpdateInput = {};
  if (typeof input.name === "string") {
    const name = input.name.trim();
    if (!name) throw new Error("Name is required.");
    if (name.length > 80) throw new Error("Keep the name under 80 characters.");
    data.name = name;
    // The slug is part of shareable /events?category= links, so it only
    // moves when the name it was derived from actually changes.
    const current = await prisma.eventCategory.findUnique({
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
  return prisma.eventCategory.update({ where: { id }, data });
}

/**
 * Delete a category outright.
 *
 * Refused while events still reference it. The FK is SetNull, so
 * deleting wouldn't lose the events — it would quietly strip their
 * category, which is a surprising outcome for a button labelled
 * "delete". Retiring is the intended path and the error says so.
 */
export async function deleteCategory(id: string) {
  const used = await prisma.event.count({ where: { categoryId: id } });
  if (used > 0) {
    throw new Error(
      `${used} event${used === 1 ? "" : "s"} still use this category. Retire it instead, or move them first.`,
    );
  }
  await prisma.eventCategory.delete({ where: { id } });
}
