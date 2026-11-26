/**
 * Map & directory — admin side, plus member submissions.
 *
 * THE GEOCODING RULE lives here: coordinates are looked up when a
 * place is created or its address changes, and written to the row.
 * Nothing on the read path ever calls the geocoder. If you find
 * yourself adding a `geocode()` call to a list or a page, stop —
 * that is the mistake the plan warns about, and it gets the app
 * blocked by Nominatim rather than producing a nicer map.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { createUserNotification } from "./notifications";
import { createForAllAdmins } from "./admin-notifications";
import { deleteMediaByUrls, extractLocalImageUrls } from "./media";
import { attachedImageUrls, sanitiseImages, MAX_GALLERY_PHOTOS } from "./attached-media";
import { geocode, isValidCoordinate } from "./geocode";
import { slugify } from "./geography-admin";
import type { PlaceTypeValue } from "./places";

export type PlaceStatusValue = "PENDING" | "APPROVED" | "REJECTED" | "CLOSED";

export interface PlaceWriteInput {
  name: string;
  type?: PlaceTypeValue;
  summary?: string | null;
  about?: string | null;
  addressLine?: string | null;
  city?: string | null;
  postcode?: string | null;
  countryId?: string | null;
  stateId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  hours?: Array<{ day: number; opens?: string; closes?: string; closed?: boolean }> | null;
  needs?: string | null;
  coverUrl?: string | null;
  /** Extra photos beyond the cover. Capped at MAX_GALLERY_PHOTOS. */
  photos?: Array<{ url?: unknown; alt?: unknown }> | null;
  isDonor?: boolean;
  status?: PlaceStatusValue;
}

function clean(v: string | null | undefined, max = 500): string | null {
  const t = v?.trim();
  return t ? t.slice(0, max) : null;
}

async function uniquePlaceSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "place";
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await prisma.place.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

function normalise(input: PlaceWriteInput) {
  const name = input.name?.trim();
  if (!name) throw new Error("Name is required");

  const website = clean(input.website);
  if (website && !/^https?:\/\//i.test(website)) {
    throw new Error("The website must start with http:// or https://");
  }

  return {
    name: name.slice(0, 200),
    type: (input.type ?? "OTHER") as PlaceTypeValue,
    summary: clean(input.summary, 400),
    about: clean(input.about, 20_000),
    addressLine: clean(input.addressLine, 300),
    city: clean(input.city, 120),
    postcode: clean(input.postcode, 30),
    countryId: clean(input.countryId, 60),
    stateId: clean(input.stateId, 60),
    phone: clean(input.phone, 40),
    email: clean(input.email, 200),
    website,
    needs: clean(input.needs, 4000),
    coverUrl: clean(input.coverUrl),
    /*
     * Cast HERE, not at each call site.
     *
     * Prisma's InputJsonValue wants an index signature and
     * AttachedImage is a closed shape on purpose, so the conversion
     * has to happen somewhere; doing it once in normalise means
     * create, update and submit all get the same value. Same trick
     * `hours` already uses two lines down.
     *
     * `DbNull` and not `undefined` when the gallery is empty:
     * undefined means "leave the column alone" on an update, so an
     * admin removing the last photo would silently keep it.
     */
    photos: ((): Prisma.InputJsonValue | typeof Prisma.DbNull => {
      const list = sanitiseImages(input.photos, MAX_GALLERY_PHOTOS);
      return list.length ? (list as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
    })(),
    isDonor: input.isDonor ?? false,
    // Prisma's InputJsonValue wants an index signature; StoredHour is a
    // closed shape on purpose, so cast at the boundary rather than
    // loosening the type everywhere it is read.
    hours: normaliseHours(input.hours) as unknown as Prisma.InputJsonValue | undefined,
  };
}

/** Only well-formed rows are stored, so the reader's parser rarely
 *  has anything to defend against. */
interface StoredHour {
  day: number;
  opens?: string;
  closes?: string;
  closed?: boolean;
}

function normaliseHours(raw: PlaceWriteInput["hours"]): StoredHour[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: StoredHour[] = raw.flatMap<StoredHour>((h) => {
    const day = Number(h?.day);
    if (!Number.isInteger(day) || day < 0 || day > 6) return [];
    if (h.closed) return [{ day, closed: true }];
    const time = (v: unknown) =>
      typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v.trim()) ? v.trim() : undefined;
    const opens = time(h.opens);
    const closes = time(h.closes);
    if (!opens || !closes) return [];
    return [{ day, opens, closes }];
  });
  return out.length ? out : undefined;
}

/** The address fields the geocoder cares about, as one comparable key. */
function addressKey(p: {
  addressLine?: string | null;
  city?: string | null;
  postcode?: string | null;
  countryId?: string | null;
}): string {
  return [p.addressLine, p.city, p.postcode, p.countryId].map((x) => x ?? "").join("|");
}

/**
 * Look the address up and return the fields to write.
 *
 * A failed lookup is NOT an error the caller has to handle — the place
 * is still worth having in the directory, it just has no pin yet, and
 * `geocodeError` says why so an admin can fix the address or type the
 * coordinates in by hand.
 */
async function geocodeFields(
  data: ReturnType<typeof normalise>,
  countryName?: string | null,
) {
  const outcome = await geocode({
    addressLine: data.addressLine,
    city: data.city,
    postcode: data.postcode,
    country: countryName ?? null,
  });
  if (!outcome.ok) {
    return { latitude: null, longitude: null, geocodedAt: null, geocodeError: outcome.error.slice(0, 300) };
  }
  return {
    latitude: outcome.result.latitude,
    longitude: outcome.result.longitude,
    geocodedAt: new Date(),
    geocodeError: null,
  };
}

async function countryNameFor(countryId: string | null): Promise<string | null> {
  if (!countryId) return null;
  const c = await prisma.country.findUnique({ where: { id: countryId }, select: { name: true } });
  return c?.name ?? null;
}

/* ── read ────────────────────────────────────────────────────── */

export async function listAdminPlaces(filters: {
  status?: PlaceStatusValue | "ALL";
  type?: PlaceTypeValue | "ALL";
  q?: string;
  page?: number;
  perPage?: number;
} = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(1, filters.perPage ?? 25));
  const where: Record<string, unknown> = {};
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.type && filters.type !== "ALL") where.type = filters.type;
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [{ name: { contains: q } }, { city: { contains: q } }, { addressLine: { contains: q } }];
  }

  const [items, total, pending] = await Promise.all([
    prisma.place.findMany({
      where,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, slug: true, name: true, type: true, status: true, city: true,
        addressLine: true, latitude: true, longitude: true, geocodeError: true,
        isDonor: true, coverUrl: true, saveCount: true, submitterSnapshot: true,
        updatedAt: true,
      },
    }),
    prisma.place.count({ where }),
    prisma.place.count({ where: { status: "PENDING" } }),
  ]);

  return { items, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)), pending };
}

export async function getAdminPlace(id: string) {
  return prisma.place.findUnique({ where: { id } });
}

/* ── write ───────────────────────────────────────────────────── */

export async function createPlaceAsAdmin(input: PlaceWriteInput, adminId?: string) {
  const data = normalise(input);
  const slug = await uniquePlaceSlug(data.name);

  // An admin who typed coordinates is trusted over the geocoder.
  const manual = isValidCoordinate(input.latitude, input.longitude);
  const coords = manual
    ? {
        latitude: input.latitude as number,
        longitude: input.longitude as number,
        geocodedAt: new Date(),
        geocodeError: null,
      }
    : await geocodeFields(data, await countryNameFor(data.countryId));

  const place = await prisma.place.create({
    data: {
      ...data,
      ...coords,
      slug,
      status: input.status ?? "APPROVED",
      reviewedAt: new Date(),
      reviewedByAdminId: adminId ?? null,
    },
    select: { id: true, slug: true, status: true },
  });

  if (place.status === "APPROVED") await ensurePlaceRoom(place.id);
  return place;
}

export async function updatePlace(id: string, input: Partial<PlaceWriteInput>) {
  const current = await prisma.place.findUnique({ where: { id } });
  if (!current) throw new Error("Place not found");

  const merged = normalise({
    name: input.name ?? current.name,
    type: (input.type ?? current.type) as PlaceTypeValue,
    summary: input.summary !== undefined ? input.summary : current.summary,
    about: input.about !== undefined ? input.about : current.about,
    addressLine: input.addressLine !== undefined ? input.addressLine : current.addressLine,
    city: input.city !== undefined ? input.city : current.city,
    postcode: input.postcode !== undefined ? input.postcode : current.postcode,
    countryId: input.countryId !== undefined ? input.countryId : current.countryId,
    stateId: input.stateId !== undefined ? input.stateId : current.stateId,
    phone: input.phone !== undefined ? input.phone : current.phone,
    email: input.email !== undefined ? input.email : current.email,
    website: input.website !== undefined ? input.website : current.website,
    hours: input.hours !== undefined ? input.hours : (current.hours as PlaceWriteInput["hours"]),
    needs: input.needs !== undefined ? input.needs : current.needs,
    coverUrl: input.coverUrl !== undefined ? input.coverUrl : current.coverUrl,
    photos:
      input.photos !== undefined
        ? input.photos
        : (current.photos as Array<{ url?: unknown; alt?: unknown }> | null),
    isDonor: input.isDonor ?? current.isDonor,
  });

  // Re-geocode ONLY when the address actually changed. Editing a phone
  // number should not spend a Nominatim request.
  const addressChanged = addressKey(merged) !== addressKey(current);
  const manual =
    input.latitude !== undefined &&
    input.longitude !== undefined &&
    isValidCoordinate(input.latitude, input.longitude);

  let coords: Record<string, unknown> = {};
  if (manual) {
    coords = {
      latitude: input.latitude,
      longitude: input.longitude,
      geocodedAt: new Date(),
      geocodeError: null,
    };
  } else if (addressChanged) {
    coords = await geocodeFields(merged, await countryNameFor(merged.countryId));
  }

  return prisma.place.update({
    where: { id },
    data: { ...merged, ...coords, ...(input.status ? { status: input.status } : {}) },
    select: { id: true, slug: true, status: true },
  });
}

/** Re-run the lookup on demand, for a place whose address was right
 *  but whose geocode failed at the time. */
export async function regeocodePlace(id: string) {
  const place = await prisma.place.findUnique({ where: { id } });
  if (!place) throw new Error("Place not found");
  const coords = await geocodeFields(
    {
      addressLine: place.addressLine,
      city: place.city,
      postcode: place.postcode,
    } as ReturnType<typeof normalise>,
    await countryNameFor(place.countryId),
  );
  await prisma.place.update({ where: { id }, data: coords });
  return coords;
}

export async function deletePlace(id: string) {
  const place = await prisma.place.findUnique({
    where: { id },
    select: { coverUrl: true, photos: true, about: true },
  });
  await prisma.place.delete({ where: { id } });
  await deleteMediaByUrls(
    // The GALLERY too — without it, deleting a place leaves every
    // photo but the cover on disk with nothing pointing at it.
    [
      place?.coverUrl,
      ...attachedImageUrls(place?.photos),
      ...extractLocalImageUrls(place?.about),
    ],
    { allowAnyOwner: true },
  );
}

/* ── submissions and review ──────────────────────────────────── */

export async function submitPlace(
  input: PlaceWriteInput,
  user: { id: string; displayName: string },
) {
  const data = normalise(input);
  const slug = await uniquePlaceSlug(data.name);

  // Submissions are geocoded on the way in, so the reviewing admin can
  // see the pin before deciding — a place nobody can find on a map is
  // usually a place with a wrong address.
  const coords = await geocodeFields(data, await countryNameFor(data.countryId));

  const place = await prisma.place.create({
    data: {
      ...data,
      ...coords,
      slug,
      // A member cannot mark their own listing as a donating business,
      // or publish it.
      isDonor: false,
      status: "PENDING",
      submittedByUserId: user.id,
      submitterSnapshot: user.displayName,
    },
    select: { id: true, slug: true, name: true },
  });

  await createForAllAdmins({
    type: "PLACE_PENDING",
    title: "A place is waiting for review",
    message: `${user.displayName} submitted “${place.name}”.`,
    actionUrl: "/admin/places?status=PENDING",
  }).catch(() => {});

  return place;
}

export async function reviewPlace(
  placeId: string,
  adminId: string,
  action: "approve" | "reject",
  note?: string,
) {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { id: true, slug: true, name: true, submittedByUserId: true },
  });
  if (!place) throw new Error("Place not found");

  const status: PlaceStatusValue = action === "approve" ? "APPROVED" : "REJECTED";
  const reviewNote = action === "reject" ? clean(note, 2000) : null;

  await prisma.place.update({
    where: { id: placeId },
    data: { status, reviewNote, reviewedAt: new Date(), reviewedByAdminId: adminId },
  });

  if (action === "approve") await ensurePlaceRoom(placeId);

  if (place.submittedByUserId) {
    await createUserNotification({
      userId: place.submittedByUserId,
      type: action === "approve" ? "PLACE_APPROVED" : "PLACE_REJECTED",
      title: action === "approve" ? "Your place was added" : "Your place wasn't added",
      body:
        action === "approve"
          ? `“${place.name}” is now on the map.`
          : reviewNote
            ? `Reason: ${reviewNote}`
            : "It didn't meet our directory guidelines.",
      actionUrl: action === "approve" ? `/places/${place.slug}` : "/places",
    }).catch(() => {});
  }

  return { status };
}

/**
 * One chatroom per place, idempotently — the unique `placeId` on
 * ChatRoom is what makes a double-approval safe.
 */
export async function ensurePlaceRoom(placeId: string): Promise<string | null> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    select: { id: true, slug: true, name: true, summary: true, countryId: true, chatRoomId: true },
  });
  if (!place) return null;
  if (place.chatRoomId) return place.chatRoomId;

  const existing = await prisma.chatRoom.findUnique({
    where: { placeId },
    select: { id: true },
  });
  if (existing) {
    await prisma.place.update({ where: { id: placeId }, data: { chatRoomId: existing.id } });
    return existing.id;
  }

  try {
    const room = await prisma.chatRoom.create({
      data: {
        slug: `place-${place.slug}`.slice(0, 190),
        name: place.name,
        description: place.summary ?? `Questions and updates about ${place.name}.`,
        tier: "PUBLIC",
        countryId: place.countryId,
        placeId: place.id,
        emoji: "📍",
      },
      select: { id: true },
    });
    await prisma.place.update({ where: { id: placeId }, data: { chatRoomId: room.id } });
    return room.id;
  } catch {
    // Lost a race to another approval; take whatever won.
    const room = await prisma.chatRoom.findUnique({ where: { placeId }, select: { id: true } });
    if (room) {
      await prisma.place.update({ where: { id: placeId }, data: { chatRoomId: room.id } });
      return room.id;
    }
    return null;
  }
}
