/**
 * Map & directory — reader side.
 *
 * One dataset, two views. The map asks for a bounding box; the list
 * asks for a page. Both go through `listPlaces`, because the moment
 * they diverge the map starts showing pins the list denies exist.
 *
 * WHY A BOUNDING BOX AND NOT A RADIUS: a radius means computing a
 * great-circle distance for every row before you can filter, which is
 * a full table scan. A box is two range comparisons that use the
 * `(status, latitude, longitude)` index. The box narrows, and the
 * distance sort then runs over the handful of rows that came back.
 */

import { prisma } from "./db";
import { boundingBox, distanceKm, isValidCoordinate } from "./geocode";

export type PlaceTypeValue =
  | "RECOVERY_PROGRAM"
  | "CLINIC"
  | "COUNSELLING"
  | "CHURCH"
  | "FOOD_BANK"
  | "ANIMAL_SHELTER"
  | "SHELTER"
  | "COMMUNITY_CENTRE"
  | "DONATING_BUSINESS"
  | "OTHER";

/**
 * Labels, pin colours, slugs and blurbs, in one place so the map, the
 * filter chips, the category tiles and the admin form can never
 * disagree about what a type is called.
 *
 * NO PlaceCategory TABLE, deliberately. Every other section here has
 * one because an admin needs to add and retire categories over time;
 * a place's type is a database ENUM, fixed at the schema, and the map
 * pin colours are keyed off it in code. A table would be a second copy
 * of a list that already exists, needing a migration and a seed to
 * stay in step with the enum it duplicates — so the tiles are built
 * from this array instead, and adding a type is a schema change,
 * which is what it already was.
 *
 * `slug` is the URL of /places/category/[slug]. Written out rather
 * than derived from `value.toLowerCase()`, because these are in links
 * people share and a rename of the enum member should not silently
 * break them.
 */
export const PLACE_TYPES: Array<{
  value: PlaceTypeValue;
  label: string;
  emoji: string;
  /** Tailwind-safe hex, used for the map pin and the tile's icon disc. */
  colour: string;
  /** The /places/category/[slug] segment. Stable; not derived. */
  slug: string;
  /** One line on the tile, saying what you would actually find. */
  blurb: string;
}> = [
  { value: "RECOVERY_PROGRAM", label: "Recovery program", emoji: "🌱", colour: "#10b981", slug: "recovery-programs", blurb: "Meetings, treatment and the people who run them." },
  { value: "CLINIC", label: "Clinic", emoji: "🏥", colour: "#ef4444", slug: "clinics", blurb: "Walk-in care, prescriptions and testing." },
  { value: "COUNSELLING", label: "Counselling", emoji: "🗣", colour: "#8b5cf6", slug: "counselling", blurb: "Talking therapy, one to one or in a group." },
  { value: "CHURCH", label: "Church or faith group", emoji: "⛪", colour: "#6366f1", slug: "faith-groups", blurb: "Congregations and the help they hand out." },
  { value: "FOOD_BANK", label: "Food bank", emoji: "🥫", colour: "#f59e0b", slug: "food-banks", blurb: "Parcels, pantries and hot meals." },
  { value: "ANIMAL_SHELTER", label: "Animal shelter", emoji: "🐕", colour: "#14b8a6", slug: "animal-shelters", blurb: "Rescues, fosters and somewhere to volunteer." },
  { value: "SHELTER", label: "Shelter or housing", emoji: "🏠", colour: "#0ea5e9", slug: "shelters", blurb: "A bed tonight, and help finding one for longer." },
  { value: "COMMUNITY_CENTRE", label: "Community centre", emoji: "🏛", colour: "#64748b", slug: "community-centres", blurb: "Halls, groups and noticeboards worth reading." },
  { value: "DONATING_BUSINESS", label: "Donating business", emoji: "🛍", colour: "#22c55e", slug: "donating-businesses", blurb: "Local shops putting something back." },
  { value: "OTHER", label: "Other", emoji: "📍", colour: "#94a3b8", slug: "other", blurb: "Everything that doesn't fit the rest." },
];

export function placeTypeLabel(type: string): string {
  return PLACE_TYPES.find((t) => t.value === type)?.label ?? "Place";
}
export function placeTypeEmoji(type: string): string {
  return PLACE_TYPES.find((t) => t.value === type)?.emoji ?? "📍";
}

/** Resolve a /places/category/[slug] segment. Null for anything else. */
export function placeTypeBySlug(slug: string | null | undefined) {
  if (!slug) return null;
  const clean = slug.trim().toLowerCase();
  return PLACE_TYPES.find((t) => t.slug === clean) ?? null;
}

export interface PlaceTypeTile {
  value: PlaceTypeValue;
  label: string;
  emoji: string;
  colour: string;
  slug: string;
  blurb: string;
  /** Approved places of this type, in the country being looked at. */
  count: number;
}

/**
 * The type tiles, with how many places each holds.
 *
 * EVERY TYPE IS RETURNED, including the empty ones — the same call
 * every other section's tiles make. On a directory that is only ever
 * as good as what people have added to it, "Animal shelters · Nothing
 * yet" is the most useful tile on the page: it says what belongs here
 * and it is the one a reader can do something about.
 *
 * `countryId` narrows the counts to the directory the viewer is
 * actually looking at. A tile saying 12 above a list showing none is
 * the country filter lying about itself.
 *
 * ONE groupBy, not ten counts. Ten round trips to render one grid is
 * ten chances for the page to be slow.
 */
export async function listPlaceTypeTiles(
  opts: { countryId?: string | null } = {},
): Promise<PlaceTypeTile[]> {
  const rows = await prisma.place.groupBy({
    by: ["type"],
    where: {
      status: "APPROVED",
      ...(opts.countryId ? { countryId: opts.countryId } : {}),
    },
    _count: { _all: true },
    // Prisma wants an orderBy alongside a grouped aggregate. Never
    // read — the result is keyed into a Map below.
    orderBy: { _count: { type: "desc" } },
  });
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.type, r._count._all);
  return PLACE_TYPES.map((t) => ({ ...t, count: by.get(t.value) ?? 0 }));
}

const CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  type: true,
  summary: true,
  addressLine: true,
  city: true,
  postcode: true,
  latitude: true,
  longitude: true,
  phone: true,
  website: true,
  isDonor: true,
  coverUrl: true,
  saveCount: true,
  needs: true,
  countryId: true,
} as const;

export interface PlaceFilters {
  types?: PlaceTypeValue[];
  donorOnly?: boolean;
  countryId?: string | null;
  q?: string;
  /** Map viewport, in kilometres around a centre. */
  near?: { lat: number; lng: number; km: number } | null;
  /** Only places that have coordinates — the map can't show the rest. */
  mappableOnly?: boolean;
  /** Region within the country, when the country has states/provinces. */
  stateId?: string | null;
  /**
   * Only places this viewer has saved. Folded into the same query rather
   * than given its own reader, so the Saved tab keeps every filter the
   * other two views have — a saved-only list that ignored the type chips
   * would be a third view that disagrees with the other two.
   */
  savedOnly?: boolean;
  page?: number;
  perPage?: number;
  viewerId?: string | null;
}

export async function listPlaces(filters: PlaceFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(200, Math.max(1, filters.perPage ?? 50));

  const where: Record<string, unknown> = { status: "APPROVED" };
  if (filters.types?.length) where.type = { in: filters.types };
  if (filters.donorOnly) where.isDonor = true;
  if (filters.countryId) where.countryId = filters.countryId;
  if (filters.stateId) where.stateId = filters.stateId;
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { name: { contains: q } },
      { summary: { contains: q } },
      { city: { contains: q } },
      { needs: { contains: q } },
    ];
  }

  if (filters.near && isValidCoordinate(filters.near.lat, filters.near.lng)) {
    const box = boundingBox(filters.near.lat, filters.near.lng, filters.near.km);
    where.latitude = { gte: box.minLat, lte: box.maxLat };
    where.longitude = { gte: box.minLng, lte: box.maxLng };
  } else if (filters.mappableOnly) {
    where.latitude = { not: null };
    where.longitude = { not: null };
  }

  if (filters.savedOnly) {
    const saves = filters.viewerId
      ? await prisma.placeSave.findMany({
          where: { userId: filters.viewerId },
          orderBy: { createdAt: "desc" },
          // A cap, so one enthusiastic member can't turn this into an
          // unbounded IN list. Nobody saves five hundred places.
          take: 500,
          select: { placeId: true },
        })
      : [];
    // `in: []` matches nothing, which is the right answer for a viewer
    // who has saved nothing — and keeps one return shape for one reader.
    where.id = { in: saves.map((r) => r.placeId) };
  }

  const [rows, total] = await Promise.all([
    prisma.place.findMany({
      where,
      orderBy: [{ isDonor: "desc" }, { name: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: CARD_SELECT,
    }),
    prisma.place.count({ where }),
  ]);

  const saved = await savedIds(rows.map((r) => r.id), filters.viewerId);

  // Distance is computed here, over the page the box already narrowed.
  const centre = filters.near;
  const places = rows.map((r) => ({
    ...r,
    saved: saved.has(r.id),
    distanceKm:
      centre && isValidCoordinate(r.latitude, r.longitude)
        ? distanceKm(
            { latitude: centre.lat, longitude: centre.lng },
            { latitude: r.latitude as number, longitude: r.longitude as number },
          )
        : null,
  }));

  if (centre) places.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

  return { places, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

async function savedIds(placeIds: string[], viewerId?: string | null) {
  if (!viewerId || placeIds.length === 0) return new Set<string>();
  const rows = await prisma.placeSave.findMany({
    where: { userId: viewerId, placeId: { in: placeIds } },
    select: { placeId: true },
  });
  return new Set(rows.map((r) => r.placeId));
}

export async function getPlaceBySlug(slug: string, viewerId?: string | null) {
  const place = await prisma.place.findFirst({
    where: { slug, status: "APPROVED" },
    select: {
      ...CARD_SELECT,
      // Detail only. The list and the map draw a 48px thumbnail from
      // `coverUrl` and would never render a gallery, so they do not
      // pay to fetch one.
      photos: true,
      about: true,
      email: true,
      hours: true,
      stateId: true,
      viewCount: true,
      chatRoomId: true,
      geocodedAt: true,
      createdAt: true,
    },
  });
  if (!place) return null;

  const [saved, room, country] = await Promise.all([
    viewerId
      ? prisma.placeSave.findUnique({
          where: { placeId_userId: { placeId: place.id, userId: viewerId } },
          select: { userId: true },
        })
      : null,
    // Loose FK — the room may have been deleted since.
    place.chatRoomId
      ? prisma.chatRoom.findUnique({
          where: { id: place.chatRoomId },
          select: { id: true, slug: true, name: true, memberCount: true },
        })
      : null,
    place.countryId
      ? prisma.country.findUnique({
          where: { id: place.countryId },
          select: { name: true, emojiFlag: true },
        })
      : null,
  ]);

  return { ...place, saved: !!saved, room, country };
}

export async function togglePlaceSave(placeId: string, userId: string) {
  const key = { placeId_userId: { placeId, userId } };
  const existing = await prisma.placeSave.findUnique({ where: key, select: { userId: true } });

  if (existing) await prisma.placeSave.delete({ where: key });
  else await prisma.placeSave.create({ data: { placeId, userId } });

  const saveCount = await prisma.placeSave.count({ where: { placeId } });
  await prisma.place.update({ where: { id: placeId }, data: { saveCount } });
  return { saved: !existing, saveCount };
}

/** Fire-and-forget view counter — never block a render on it. */
export async function recordPlaceView(id: string): Promise<void> {
  await prisma.place
    .update({ where: { id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});
}

/* ── saved filter sets ───────────────────────────────────────── */

export async function listFilterSets(userId: string) {
  return prisma.placeFilterSet.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, name: true, filters: true, createdAt: true },
  });
}

/**
 * The filter payload is written by the client, so it is rebuilt here from
 * known keys rather than stored as it arrives. Otherwise this column is a
 * place any logged-in member can park arbitrary JSON of arbitrary size,
 * which the directory will then hand back to them on every page load.
 */
function cleanFilters(input: unknown) {
  const raw = (input ?? {}) as Record<string, unknown>;
  const types = Array.isArray(raw.types)
    ? (raw.types.filter((t) => PLACE_TYPES.some((p) => p.value === t)) as PlaceTypeValue[])
    : [];
  const stateId =
    typeof raw.stateId === "string" && raw.stateId.length <= 40 ? raw.stateId : "";
  const q = typeof raw.q === "string" ? raw.q.trim().slice(0, 120) : "";

  return {
    ...(types.length ? { types } : {}),
    ...(raw.donorOnly === true ? { donorOnly: true } : {}),
    ...(stateId ? { stateId } : {}),
    ...(q ? { q } : {}),
  };
}

export async function saveFilterSet(userId: string, name: string, filters: unknown) {
  const clean = name.trim().slice(0, 80);
  if (!clean) throw new Error("Give the filter set a name");
  const count = await prisma.placeFilterSet.count({ where: { userId } });
  if (count >= 20) throw new Error("That's 20 saved filters — remove one first.");
  return prisma.placeFilterSet.create({
    data: { userId, name: clean, filters: cleanFilters(filters) },
    select: { id: true, name: true, filters: true },
  });
}

export async function deleteFilterSet(userId: string, id: string) {
  // Scoped by userId so an id from someone else's account deletes
  // nothing rather than 403-ing and confirming it exists.
  await prisma.placeFilterSet.deleteMany({ where: { id, userId } });
}

/* ── hours ───────────────────────────────────────────────────── */

export interface OpeningHour {
  day: number; // 0 = Sunday
  opens?: string;
  closes?: string;
  closed?: boolean;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The stored hours blob, defensively — it is a JSON column with no
 * schema, and a malformed row must not take the place page down.
 */
export function parseHours(raw: unknown): OpeningHour[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const h = item as Record<string, unknown>;
    const day = typeof h.day === "number" ? h.day : Number(h.day);
    if (!Number.isInteger(day) || day < 0 || day > 6) return [];
    return [
      {
        day,
        opens: typeof h.opens === "string" ? h.opens : undefined,
        closes: typeof h.closes === "string" ? h.closes : undefined,
        closed: h.closed === true,
      },
    ];
  });
}

export function dayName(day: number): string {
  return DAY_NAMES[day] ?? "";
}

/* ── links out ───────────────────────────────────────────────── */

/**
 * A directions link, on OpenStreetMap.
 *
 * The map is OSM tiles, so the "Directions" button being Google was
 * both inconsistent and an unnecessary hand-off to a tracker. OSM's
 * own directions page routes with FOSSGIS's OSRM instance and takes
 * plain coordinates.
 *
 * Coordinates are preferred over the address string: they are what we
 * verified, and a free-text address can resolve to the wrong town.
 */
export function directionsUrl(place: {
  latitude?: number | null;
  longitude?: number | null;
  addressLine?: string | null;
  city?: string | null;
  postcode?: string | null;
}): string | null {
  if (typeof place.latitude === "number" && typeof place.longitude === "number") {
    const to = `${place.latitude},${place.longitude}`;
    return `https://www.openstreetmap.org/directions?to=${encodeURIComponent(to)}`;
  }
  const address = [place.addressLine, place.city, place.postcode].filter(Boolean).join(", ");
  if (!address) return null;
  // No coordinates: send them to a search rather than a route, so they
  // can see what was found before setting off.
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;
}

/** The place on the map, without routing. */
export function mapUrl(lat: number, lng: number, zoom = 17): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}
