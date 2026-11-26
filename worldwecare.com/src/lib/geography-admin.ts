/**
 * Geography admin helpers — CRUD for Region, SubRegion, Country, State.
 *
 * Rules baked in:
 *   • States can only be created/edited under the United States
 *     (country.code === "US"). Enforced in `assertUsCountry()`.
 *   • Slugs are unique per-level (globally for the first three,
 *     per-country for states). Slug generator strips accents and
 *     lowercases so admins can just type "São Paulo" and get a
 *     safe slug.
 *   • Cascade deletes are already declared in the schema. The delete
 *     helpers here just add human-readable error messages when a
 *     row has dependents so we don't nuke a whole subtree by
 *     accident from the admin panel.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

/* ── Shared ──────────────────────────────────────────────────── */

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export type LevelKind = "region" | "subRegion" | "country" | "state";

/* ── DTOs ────────────────────────────────────────────────────── */

export interface RegionDto {
  id: string;
  slug: string;
  name: string;
  code: string;
  sortOrder: number;
  isActive: boolean;
  subRegionCount: number;
  countryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubRegionDto {
  id: string;
  slug: string;
  name: string;
  code: string;
  regionId: string;
  regionName: string;
  regionSlug: string;
  sortOrder: number;
  isActive: boolean;
  countryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CountryDto {
  id: string;
  slug: string;
  name: string;
  code: string;
  code3: string | null;
  numericCode: string | null;
  flagUrl: string | null;
  emojiFlag: string | null;
  phoneCode: string | null;
  currency: string | null;
  language: string | null;
  subRegionId: string;
  subRegionName: string;
  subRegionSlug: string;
  regionId: string;
  regionName: string;
  regionSlug: string;
  sortOrder: number;
  isActive: boolean;
  stateCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StateDto {
  id: string;
  slug: string;
  name: string;
  code: string;
  capital: string | null;
  countryId: string;
  countryName: string;
  countryCode: string;
  countrySlug: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ── Guards ──────────────────────────────────────────────────── */

/** States only exist for the United States (product decision). */
async function assertUsCountry(countryId: string): Promise<void> {
  const c = await prisma.country.findUnique({
    where: { id: countryId },
    select: { code: true, name: true },
  });
  if (!c) throw new Error("Country not found");
  if (c.code !== "US") {
    throw new Error(
      `States are only supported for the United States. "${c.name}" (${c.code}) can't have states.`,
    );
  }
}

async function assertUniqueSlug(
  kind: LevelKind,
  slug: string,
  extra: { countryId?: string; excludeId?: string } = {},
): Promise<void> {
  const clean = slugify(slug);
  if (!clean) throw new Error("Slug can't be empty.");
  if (kind === "region") {
    const hit = await prisma.region.findFirst({
      where: { slug: clean, ...(extra.excludeId ? { id: { not: extra.excludeId } } : {}) },
      select: { id: true },
    });
    if (hit) throw new Error(`Another region already uses the slug "${clean}".`);
  } else if (kind === "subRegion") {
    const hit = await prisma.subRegion.findFirst({
      where: { slug: clean, ...(extra.excludeId ? { id: { not: extra.excludeId } } : {}) },
      select: { id: true },
    });
    if (hit) throw new Error(`Another sub-region already uses the slug "${clean}".`);
  } else if (kind === "country") {
    const hit = await prisma.country.findFirst({
      where: { slug: clean, ...(extra.excludeId ? { id: { not: extra.excludeId } } : {}) },
      select: { id: true },
    });
    if (hit) throw new Error(`Another country already uses the slug "${clean}".`);
  } else if (kind === "state") {
    if (!extra.countryId) throw new Error("State slug check needs a countryId.");
    const hit = await prisma.state.findFirst({
      where: {
        countryId: extra.countryId,
        slug: clean,
        ...(extra.excludeId ? { id: { not: extra.excludeId } } : {}),
      },
      select: { id: true },
    });
    if (hit) throw new Error(`Another state in this country already uses the slug "${clean}".`);
  }
}

/* ── Region ──────────────────────────────────────────────────── */

export async function listRegions(q?: string): Promise<RegionDto[]> {
  const where: Prisma.RegionWhereInput = q
    ? {
        OR: [
          { name: { contains: q } },
          { code: { contains: q } },
          { slug: { contains: q } },
        ],
      }
    : {};
  const rows = await prisma.region.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { subRegions: true } },
      subRegions: { select: { _count: { select: { countries: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    code: r.code,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
    subRegionCount: r._count.subRegions,
    countryCount: r.subRegions.reduce((sum, sr) => sum + sr._count.countries, 0),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export interface CreateRegionInput {
  slug?: string;
  name: string;
  code: string;
  sortOrder?: number;
  isActive?: boolean;
}

export async function createRegion(input: CreateRegionInput): Promise<void> {
  const slug = slugify(input.slug ?? input.name);
  await assertUniqueSlug("region", slug);
  const existing = await prisma.region.findUnique({ where: { code: input.code } });
  if (existing) throw new Error(`A region with code "${input.code}" already exists.`);
  await prisma.region.create({
    data: {
      slug,
      name: input.name.trim(),
      code: input.code.trim(),
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  });
}

export interface UpdateRegionInput {
  slug?: string;
  name?: string;
  code?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export async function updateRegion(id: string, input: UpdateRegionInput): Promise<void> {
  const before = await prisma.region.findUnique({ where: { id } });
  if (!before) throw new Error("Region not found");
  const data: Prisma.RegionUpdateInput = {};
  if (input.slug !== undefined) {
    const slug = slugify(input.slug);
    await assertUniqueSlug("region", slug, { excludeId: id });
    data.slug = slug;
  }
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.code !== undefined) {
    const code = input.code.trim();
    if (code !== before.code) {
      const clash = await prisma.region.findUnique({ where: { code } });
      if (clash) throw new Error(`A region with code "${code}" already exists.`);
    }
    data.code = code;
  }
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  await prisma.region.update({ where: { id }, data });
}

export async function deleteRegion(id: string): Promise<void> {
  const dependents = await prisma.subRegion.count({ where: { regionId: id } });
  if (dependents > 0) {
    throw new Error(
      `Can't delete — this region has ${dependents} sub-region(s). Move or delete them first.`,
    );
  }
  await prisma.region.delete({ where: { id } });
}

/* ── SubRegion ───────────────────────────────────────────────── */

export interface ListSubRegionOpts {
  q?: string;
  regionId?: string;
}

export async function listSubRegions(opts: ListSubRegionOpts = {}): Promise<SubRegionDto[]> {
  const where: Prisma.SubRegionWhereInput = {};
  if (opts.regionId) where.regionId = opts.regionId;
  if (opts.q) {
    where.OR = [
      { name: { contains: opts.q } },
      { code: { contains: opts.q } },
      { slug: { contains: opts.q } },
    ];
  }
  const rows = await prisma.subRegion.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      region: { select: { id: true, name: true, slug: true } },
      _count: { select: { countries: true } },
    },
  });
  return rows.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    code: s.code,
    regionId: s.regionId,
    regionName: s.region.name,
    regionSlug: s.region.slug,
    sortOrder: s.sortOrder,
    isActive: s.isActive,
    countryCount: s._count.countries,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));
}

export interface CreateSubRegionInput {
  regionId: string;
  slug?: string;
  name: string;
  code: string;
  sortOrder?: number;
  isActive?: boolean;
}

export async function createSubRegion(input: CreateSubRegionInput): Promise<void> {
  const region = await prisma.region.findUnique({ where: { id: input.regionId } });
  if (!region) throw new Error("Parent region not found.");
  const slug = slugify(input.slug ?? input.name);
  await assertUniqueSlug("subRegion", slug);
  const clash = await prisma.subRegion.findUnique({ where: { code: input.code } });
  if (clash) throw new Error(`A sub-region with code "${input.code}" already exists.`);
  await prisma.subRegion.create({
    data: {
      regionId: input.regionId,
      slug,
      name: input.name.trim(),
      code: input.code.trim(),
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  });
}

export interface UpdateSubRegionInput {
  regionId?: string;
  slug?: string;
  name?: string;
  code?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export async function updateSubRegion(id: string, input: UpdateSubRegionInput): Promise<void> {
  const before = await prisma.subRegion.findUnique({ where: { id } });
  if (!before) throw new Error("Sub-region not found");
  const data: Prisma.SubRegionUpdateInput = {};
  if (input.regionId !== undefined && input.regionId !== before.regionId) {
    const region = await prisma.region.findUnique({ where: { id: input.regionId } });
    if (!region) throw new Error("Parent region not found.");
    data.region = { connect: { id: input.regionId } };
  }
  if (input.slug !== undefined) {
    const slug = slugify(input.slug);
    await assertUniqueSlug("subRegion", slug, { excludeId: id });
    data.slug = slug;
  }
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.code !== undefined) {
    const code = input.code.trim();
    if (code !== before.code) {
      const clash = await prisma.subRegion.findUnique({ where: { code } });
      if (clash) throw new Error(`A sub-region with code "${code}" already exists.`);
    }
    data.code = code;
  }
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  await prisma.subRegion.update({ where: { id }, data });
}

export async function deleteSubRegion(id: string): Promise<void> {
  const dependents = await prisma.country.count({ where: { subRegionId: id } });
  if (dependents > 0) {
    throw new Error(
      `Can't delete — this sub-region has ${dependents} countr${dependents === 1 ? "y" : "ies"}. Move or delete them first.`,
    );
  }
  await prisma.subRegion.delete({ where: { id } });
}

/* ── Country ─────────────────────────────────────────────────── */

export interface ListCountryOpts {
  q?: string;
  regionId?: string;
  subRegionId?: string;
  status?: "all" | "active" | "inactive";
  page?: number;
  perPage?: number;
}

export async function listCountries(opts: ListCountryOpts = {}): Promise<{
  items: CountryDto[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}> {
  const page = Math.max(1, opts.page ?? 1);
  const perPage = Math.min(200, Math.max(10, opts.perPage ?? 50));

  const where: Prisma.CountryWhereInput = {};
  if (opts.subRegionId) where.subRegionId = opts.subRegionId;
  else if (opts.regionId) where.subRegion = { regionId: opts.regionId };
  if (opts.status === "active") where.isActive = true;
  else if (opts.status === "inactive") where.isActive = false;
  if (opts.q) {
    where.OR = [
      { name: { contains: opts.q } },
      { code: { contains: opts.q } },
      { code3: { contains: opts.q } },
      { slug: { contains: opts.q } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.country.findMany({
      where,
      orderBy: [{ name: "asc" }],
      include: {
        subRegion: {
          select: {
            id: true,
            name: true,
            slug: true,
            region: { select: { id: true, name: true, slug: true } },
          },
        },
        _count: { select: { states: true } },
      },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.country.count({ where }),
  ]);

  return {
    items: rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      code: c.code,
      code3: c.code3,
      numericCode: c.numericCode,
      flagUrl: c.flagUrl,
      emojiFlag: c.emojiFlag,
      phoneCode: c.phoneCode,
      currency: c.currency,
      language: c.language,
      subRegionId: c.subRegionId,
      subRegionName: c.subRegion.name,
      subRegionSlug: c.subRegion.slug,
      regionId: c.subRegion.region.id,
      regionName: c.subRegion.region.name,
      regionSlug: c.subRegion.region.slug,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      stateCount: c._count.states,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getCountry(id: string): Promise<CountryDto | null> {
  const c = await prisma.country.findUnique({
    where: { id },
    include: {
      subRegion: {
        select: {
          id: true,
          name: true,
          slug: true,
          region: { select: { id: true, name: true, slug: true } },
        },
      },
      _count: { select: { states: true } },
    },
  });
  if (!c) return null;
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    code: c.code,
    code3: c.code3,
    numericCode: c.numericCode,
    flagUrl: c.flagUrl,
    emojiFlag: c.emojiFlag,
    phoneCode: c.phoneCode,
    currency: c.currency,
    language: c.language,
    subRegionId: c.subRegionId,
    subRegionName: c.subRegion.name,
    subRegionSlug: c.subRegion.slug,
    regionId: c.subRegion.region.id,
    regionName: c.subRegion.region.name,
    regionSlug: c.subRegion.region.slug,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    stateCount: c._count.states,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export interface CreateCountryInput {
  subRegionId: string;
  slug?: string;
  name: string;
  code: string;
  code3?: string;
  numericCode?: string;
  flagUrl?: string;
  emojiFlag?: string;
  phoneCode?: string;
  currency?: string;
  language?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export async function createCountry(input: CreateCountryInput): Promise<void> {
  const sr = await prisma.subRegion.findUnique({ where: { id: input.subRegionId } });
  if (!sr) throw new Error("Parent sub-region not found.");
  const slug = slugify(input.slug ?? input.name);
  await assertUniqueSlug("country", slug);
  const codeUp = input.code.trim().toUpperCase();
  const clash = await prisma.country.findUnique({ where: { code: codeUp } });
  if (clash) throw new Error(`A country with code "${codeUp}" already exists.`);
  if (input.code3) {
    const c3 = input.code3.trim().toUpperCase();
    const clash3 = await prisma.country.findUnique({ where: { code3: c3 } });
    if (clash3) throw new Error(`A country with alpha-3 code "${c3}" already exists.`);
  }
  await prisma.country.create({
    data: {
      subRegionId: input.subRegionId,
      slug,
      name: input.name.trim(),
      code: codeUp,
      code3: input.code3?.trim().toUpperCase() ?? null,
      numericCode: input.numericCode?.trim() ?? null,
      flagUrl: input.flagUrl?.trim() || null,
      emojiFlag: input.emojiFlag?.trim() || null,
      phoneCode: input.phoneCode?.trim() || null,
      currency: input.currency?.trim().toUpperCase() || null,
      language: input.language?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  });
}

export type UpdateCountryInput = Partial<CreateCountryInput>;

export async function updateCountry(id: string, input: UpdateCountryInput): Promise<void> {
  const before = await prisma.country.findUnique({ where: { id } });
  if (!before) throw new Error("Country not found");
  const data: Prisma.CountryUpdateInput = {};

  if (input.subRegionId !== undefined && input.subRegionId !== before.subRegionId) {
    const sr = await prisma.subRegion.findUnique({ where: { id: input.subRegionId } });
    if (!sr) throw new Error("Parent sub-region not found.");
    data.subRegion = { connect: { id: input.subRegionId } };
  }
  if (input.slug !== undefined) {
    const slug = slugify(input.slug);
    await assertUniqueSlug("country", slug, { excludeId: id });
    data.slug = slug;
  }
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.code !== undefined) {
    const code = input.code.trim().toUpperCase();
    if (code !== before.code) {
      const clash = await prisma.country.findUnique({ where: { code } });
      if (clash) throw new Error(`A country with code "${code}" already exists.`);
    }
    data.code = code;
  }
  if (input.code3 !== undefined) {
    const c3 = input.code3.trim().toUpperCase() || null;
    if (c3 && c3 !== before.code3) {
      const clash = await prisma.country.findUnique({ where: { code3: c3 } });
      if (clash) throw new Error(`A country with alpha-3 code "${c3}" already exists.`);
    }
    data.code3 = c3;
  }
  if (input.numericCode !== undefined) data.numericCode = input.numericCode.trim() || null;
  if (input.flagUrl !== undefined) data.flagUrl = input.flagUrl.trim() || null;
  if (input.emojiFlag !== undefined) data.emojiFlag = input.emojiFlag.trim() || null;
  if (input.phoneCode !== undefined) data.phoneCode = input.phoneCode.trim() || null;
  if (input.currency !== undefined) data.currency = input.currency.trim().toUpperCase() || null;
  if (input.language !== undefined) data.language = input.language.trim() || null;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  await prisma.country.update({ where: { id }, data });
}

export async function deleteCountry(id: string): Promise<void> {
  const dependents = await prisma.state.count({ where: { countryId: id } });
  if (dependents > 0) {
    throw new Error(
      `Can't delete — this country has ${dependents} state(s). Move or delete them first.`,
    );
  }
  await prisma.country.delete({ where: { id } });
}

/* ── State ───────────────────────────────────────────────────── */

export interface ListStateOpts {
  q?: string;
  countryId?: string;
  status?: "all" | "active" | "inactive";
}

export async function listStates(opts: ListStateOpts = {}): Promise<StateDto[]> {
  const where: Prisma.StateWhereInput = {};
  if (opts.countryId) where.countryId = opts.countryId;
  if (opts.status === "active") where.isActive = true;
  else if (opts.status === "inactive") where.isActive = false;
  if (opts.q) {
    where.OR = [
      { name: { contains: opts.q } },
      { code: { contains: opts.q } },
      { slug: { contains: opts.q } },
    ];
  }
  const rows = await prisma.state.findMany({
    where,
    orderBy: [{ name: "asc" }],
    include: {
      country: { select: { id: true, name: true, code: true, slug: true } },
    },
  });
  return rows.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    code: s.code,
    capital: s.capital,
    countryId: s.countryId,
    countryName: s.country.name,
    countryCode: s.country.code,
    countrySlug: s.country.slug,
    sortOrder: s.sortOrder,
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));
}

export interface CreateStateInput {
  countryId: string;
  slug?: string;
  name: string;
  code: string;
  capital?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export async function createState(input: CreateStateInput): Promise<void> {
  await assertUsCountry(input.countryId);
  const slug = slugify(input.slug ?? input.name);
  await assertUniqueSlug("state", slug, { countryId: input.countryId });
  const codeUp = input.code.trim().toUpperCase();
  const clashCode = await prisma.state.findFirst({
    where: { countryId: input.countryId, code: codeUp },
  });
  if (clashCode) throw new Error(`A state with code "${codeUp}" already exists in this country.`);
  await prisma.state.create({
    data: {
      countryId: input.countryId,
      slug,
      name: input.name.trim(),
      code: codeUp,
      capital: input.capital?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
  });
}

export type UpdateStateInput = Partial<CreateStateInput>;

export async function updateState(id: string, input: UpdateStateInput): Promise<void> {
  const before = await prisma.state.findUnique({ where: { id } });
  if (!before) throw new Error("State not found");
  // Never allow re-parenting a state under a non-US country.
  const targetCountryId = input.countryId ?? before.countryId;
  await assertUsCountry(targetCountryId);

  const data: Prisma.StateUpdateInput = {};
  if (input.countryId !== undefined && input.countryId !== before.countryId) {
    data.country = { connect: { id: input.countryId } };
  }
  if (input.slug !== undefined) {
    const slug = slugify(input.slug);
    await assertUniqueSlug("state", slug, {
      countryId: targetCountryId,
      excludeId: id,
    });
    data.slug = slug;
  }
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.code !== undefined) {
    const code = input.code.trim().toUpperCase();
    if (code !== before.code || targetCountryId !== before.countryId) {
      const clash = await prisma.state.findFirst({
        where: { countryId: targetCountryId, code, id: { not: id } },
      });
      if (clash) throw new Error(`A state with code "${code}" already exists in this country.`);
    }
    data.code = code;
  }
  if (input.capital !== undefined) data.capital = input.capital.trim() || null;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  await prisma.state.update({ where: { id }, data });
}

export async function deleteState(id: string): Promise<void> {
  await prisma.state.delete({ where: { id } });
}

/* ── Overview stats ─────────────────────────────────────────── */

export interface GeographyStats {
  regions: { total: number; active: number };
  subRegions: { total: number; active: number };
  countries: { total: number; active: number };
  states: { total: number; active: number };
}

export async function getGeographyStats(): Promise<GeographyStats> {
  const [
    regionsTotal,
    regionsActive,
    subRegionsTotal,
    subRegionsActive,
    countriesTotal,
    countriesActive,
    statesTotal,
    statesActive,
  ] = await Promise.all([
    prisma.region.count(),
    prisma.region.count({ where: { isActive: true } }),
    prisma.subRegion.count(),
    prisma.subRegion.count({ where: { isActive: true } }),
    prisma.country.count(),
    prisma.country.count({ where: { isActive: true } }),
    prisma.state.count(),
    prisma.state.count({ where: { isActive: true } }),
  ]);
  return {
    regions: { total: regionsTotal, active: regionsActive },
    subRegions: { total: subRegionsTotal, active: subRegionsActive },
    countries: { total: countriesTotal, active: countriesActive },
    states: { total: statesTotal, active: statesActive },
  };
}

/** Slim option lists for pickers in the admin UI. */
export async function listRegionOptions(): Promise<
  Array<{ id: string; name: string; slug: string }>
> {
  const rows = await prisma.region.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });
  return rows;
}

export async function listSubRegionOptions(regionId?: string): Promise<
  Array<{ id: string; name: string; regionId: string; regionName: string }>
> {
  const rows = await prisma.subRegion.findMany({
    where: regionId ? { regionId } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { region: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    regionId: r.regionId,
    regionName: r.region.name,
  }));
}

export async function listCountryOptions(): Promise<
  Array<{ id: string; name: string; code: string }>
> {
  const rows = await prisma.country.findMany({
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, code: true },
  });
  return rows;
}

/** Convenience — the US id, which the States tab needs to gate on. */
export async function getUsCountryId(): Promise<string | null> {
  const row = await prisma.country.findUnique({
    where: { code: "US" },
    select: { id: true },
  });
  return row?.id ?? null;
}
