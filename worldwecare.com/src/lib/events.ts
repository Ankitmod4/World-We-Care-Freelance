/**
 * Events — real-world gatherings (Delivery 2).
 *
 * Holds both the reader and admin sides, the same shape as
 * gratitude.ts and confessions.ts. Anyone can submit an event; it sits
 * PENDING until an admin reviews it, and approval creates the event's
 * chatroom so attendees can coordinate before and after.
 *
 * Times: `startsAt` is a UTC instant and `timezone` is the IANA zone
 * the organiser entered it in. Every formatter downstream must pass
 * that zone — rendering an event in the reader's local time would put
 * someone outside a closed door.
 */

import type { Prisma, EventStatus } from "@prisma/client";
import { prisma } from "./db";
import { deleteMediaByUrls, extractLocalImageUrls } from "./media";
import { slugify } from "./geography-admin";
import { isSelectableCategory } from "./event-categories";
import { createUserNotification, createManyUserNotifications } from "./notifications";
import { createForAllAdmins } from "./admin-notifications";

const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  coverUrl: true,
  startsAt: true,
  endsAt: true,
  timezone: true,
  isOnline: true,
  venueName: true,
  city: true,
  countryId: true,
  capacity: true,
  rsvpCount: true,
  status: true,
  hostNameSnapshot: true,
  hostAvatarSnapshot: true,
  category: { select: { id: true, name: true, slug: true, emoji: true, color: true } },
} as const;

async function uniqueEventSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "event";
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await prisma.event.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

export interface EventWriteInput {
  title: string;
  description: string;
  summary?: string | null;
  coverUrl?: string | null;
  startsAt: string | Date;
  endsAt?: string | Date | null;
  timezone?: string | null;
  isOnline?: boolean;
  joinUrl?: string | null;
  venueName?: string | null;
  addressLine?: string | null;
  city?: string | null;
  countryId?: string | null;
  capacity?: number | null;
  photos?: { url: string; alt?: string }[] | null;
  /**
   * Required by the API, nullable in the schema.
   *
   * Same split as live streams: making the column non-null would fail
   * the migration on every event that already exists, while requiring
   * it at the edge means nothing NEW arrives without one.
   */
  categoryId?: string | null;
}

function clean(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

function normalise(input: EventWriteInput) {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");
  if (!input.description?.trim()) throw new Error("Description is required");

  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) throw new Error("Start time is invalid");

  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (endsAt && Number.isNaN(endsAt.getTime())) throw new Error("End time is invalid");
  if (endsAt && endsAt <= startsAt) throw new Error("The end time must be after the start time");

  const isOnline = input.isOnline ?? false;
  if (!isOnline && !clean(input.venueName) && !clean(input.addressLine)) {
    throw new Error("Add a venue or address, or mark the event as online");
  }
  if (isOnline && !clean(input.joinUrl)) throw new Error("Online events need a join link");

  return {
    title: title.slice(0, 200),
    description: input.description,
    summary: clean(input.summary)?.slice(0, 400) ?? null,
    coverUrl: clean(input.coverUrl),
    startsAt,
    endsAt,
    timezone: clean(input.timezone) ?? "UTC",
    isOnline,
    joinUrl: isOnline ? clean(input.joinUrl) : null,
    venueName: isOnline ? null : clean(input.venueName),
    addressLine: isOnline ? null : clean(input.addressLine),
    city: clean(input.city),
    countryId: clean(input.countryId),
    categoryId: clean(input.categoryId),
    capacity:
      typeof input.capacity === "number" && input.capacity > 0
        ? Math.floor(input.capacity)
        : null,
    // Keep only entries with a usable URL, and cap the gallery so one
    // submission can't push a hundred images onto the page.
    photos: Array.isArray(input.photos)
      ? input.photos
          .filter((p) => p && typeof p.url === "string" && p.url.trim())
          .slice(0, 12)
          .map((p) => ({ url: p.url.trim(), ...(p.alt?.trim() ? { alt: p.alt.trim() } : {}) }))
      : [],
  };
}

/* ── reader ──────────────────────────────────────────────────── */

export interface EventFeedFilters {
  countryId?: string | null;
  /** An EventCategory id. The route resolves ?category=<slug> to it. */
  categoryId?: string | null;
  q?: string;
  page?: number;
  perPage?: number;
  /** Past events instead of upcoming — the calendar's "Past" tab. */
  past?: boolean;
}

export async function listEvents(filters: EventFeedFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(48, Math.max(1, filters.perPage ?? 12));
  const now = new Date();

  const where: Prisma.EventWhereInput = {
    status: "APPROVED",
    // Upcoming means "hasn't finished yet" — an event running right now
    // is still worth showing.
    ...(filters.past
      ? { startsAt: { lt: now } }
      : { OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: now } }] }),
    ...(filters.countryId ? { countryId: filters.countryId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
  };
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.AND = [{ OR: [{ title: { contains: q } }, { summary: { contains: q } }, { city: { contains: q } }] }];
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: filters.past ? [{ startsAt: "desc" }] : [{ startsAt: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: CARD_SELECT,
    }),
    prisma.event.count({ where }),
  ]);

  return { events, total, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getEventBySlug(slug: string, viewerId?: string | null) {
  const event = await prisma.event.findFirst({
    where: { slug, status: { in: ["APPROVED", "CANCELLED"] } },
    select: {
      ...CARD_SELECT,
      description: true,
      photos: true,
      addressLine: true,
      joinUrl: true,
      chatRoomId: true,
      hostUserId: true,
      createdAt: true,
    },
  });
  if (!event) return null;

  const [going, room] = await Promise.all([
    viewerId
      ? prisma.eventRsvp.findUnique({
          where: { eventId_userId: { eventId: event.id, userId: viewerId } },
          select: { userId: true },
        })
      : null,
    event.chatRoomId
      ? prisma.chatRoom.findUnique({
          where: { id: event.chatRoomId },
          select: { slug: true, name: true },
        })
      : null,
  ]);

  return { ...event, going: !!going, room };
}

export async function listAttendees(eventId: string, take = 30) {
  return prisma.eventRsvp.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    take,
    select: { userId: true, nameSnapshot: true, avatarSnapshot: true },
  });
}

/**
 * Toggle the viewer's RSVP. Returns the new state and count.
 * Capacity is checked on the way in — an event that filled up while
 * the page was open rejects rather than silently overbooking.
 */
export async function toggleRsvp(
  eventId: string,
  user: { id: string; displayName: string; avatarUrl?: string | null },
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, status: true, capacity: true, rsvpCount: true },
  });
  if (!event || event.status !== "APPROVED") throw new Error("Event not found");

  const key = { eventId_userId: { eventId, userId: user.id } };
  const existing = await prisma.eventRsvp.findUnique({ where: key, select: { userId: true } });

  if (existing) {
    await prisma.eventRsvp.delete({ where: key });
  } else {
    if (event.capacity !== null && event.rsvpCount >= event.capacity) {
      throw new Error("This event is full");
    }
    await prisma.eventRsvp.create({
      data: {
        eventId,
        userId: user.id,
        nameSnapshot: user.displayName,
        avatarSnapshot: user.avatarUrl ?? null,
      },
    });
  }

  // Recount rather than increment — self-healing if a write is lost.
  const rsvpCount = await prisma.eventRsvp.count({ where: { eventId } });
  await prisma.event.update({ where: { id: eventId }, data: { rsvpCount } });
  return { going: !existing, rsvpCount };
}

/** A member submits an event. Lands PENDING and pings the admins. */
export async function submitEvent(
  input: EventWriteInput,
  user: { id: string; displayName: string; avatarUrl?: string | null },
) {
  const data = normalise(input);
  // Checked here rather than only in the form: "what kind of thing is
  // this" is the field the whole calendar is filtered by, and an
  // uncategorised event is invisible to everyone browsing by category.
  if (!data.categoryId || !(await isSelectableCategory(data.categoryId))) {
    throw new Error("Choose what kind of event this is.");
  }
  const slug = await uniqueEventSlug(data.title);

  const event = await prisma.event.create({
    data: {
      ...data,
      slug,
      status: "PENDING",
      hostUserId: user.id,
      hostNameSnapshot: user.displayName,
      hostAvatarSnapshot: user.avatarUrl ?? null,
    },
    select: { id: true, slug: true, title: true },
  });

  await createForAllAdmins({
    type: "EVENT_PENDING",
    title: "An event is waiting for review",
    message: `${user.displayName} submitted “${event.title}”.`,
    actionUrl: "/admin/events?status=PENDING",
  });

  return event;
}

/** Events the viewer is going to — used on their profile / saved area. */
export async function listMyRsvps(userId: string, take = 30) {
  const rows = await prisma.eventRsvp.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: { event: { select: CARD_SELECT } },
  });
  return rows.map((r) => r.event).filter((e) => e.status === "APPROVED");
}

/* ── admin ───────────────────────────────────────────────────── */

export async function listAdminEvents(filters: {
  status?: EventStatus | "ALL";
  q?: string;
  page?: number;
  perPage?: number;
} = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(1, filters.perPage ?? 20));

  const where: Prisma.EventWhereInput = {};
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [{ title: { contains: q } }, { city: { contains: q } }, { venueName: { contains: q } }];
  }

  const [events, total, pendingCount] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: [{ startsAt: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: { ...CARD_SELECT, rejectionReason: true, chatRoomId: true, createdAt: true },
    }),
    prisma.event.count({ where }),
    prisma.event.count({ where: { status: "PENDING" } }),
  ]);

  return { events, total, pendingCount, page, perPage, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getAdminEvent(id: string) {
  return prisma.event.findUnique({ where: { id } });
}

/** Admin-created events skip the queue — they're approved on save. */
export async function createEventAsAdmin(
  input: EventWriteInput,
  admin: { id: string; displayName: string },
) {
  const data = normalise(input);
  const slug = await uniqueEventSlug(data.title);
  const event = await prisma.event.create({
    data: {
      ...data,
      slug,
      status: "APPROVED",
      createdByAdminId: admin.id,
      hostNameSnapshot: admin.displayName,
      reviewedAt: new Date(),
      reviewedBy: admin.id,
    },
  });
  await ensureEventRoom(event.id);
  return event;
}

export async function updateEvent(id: string, input: Partial<EventWriteInput>) {
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) throw new Error("Event not found");

  // Re-validate the merged result so a partial edit can't produce an
  // invalid event (e.g. clearing the venue on an in-person event).
  const merged = normalise({
    title: input.title ?? existing.title,
    description: input.description ?? existing.description,
    summary: input.summary !== undefined ? input.summary : existing.summary,
    coverUrl: input.coverUrl !== undefined ? input.coverUrl : existing.coverUrl,
    startsAt: input.startsAt ?? existing.startsAt,
    endsAt: input.endsAt !== undefined ? input.endsAt : existing.endsAt,
    timezone: input.timezone ?? existing.timezone,
    isOnline: input.isOnline ?? existing.isOnline,
    joinUrl: input.joinUrl !== undefined ? input.joinUrl : existing.joinUrl,
    venueName: input.venueName !== undefined ? input.venueName : existing.venueName,
    addressLine: input.addressLine !== undefined ? input.addressLine : existing.addressLine,
    city: input.city !== undefined ? input.city : existing.city,
    countryId: input.countryId !== undefined ? input.countryId : existing.countryId,
    capacity: input.capacity !== undefined ? input.capacity : existing.capacity,
    photos:
      input.photos !== undefined
        ? input.photos
        : (existing.photos as { url: string; alt?: string }[] | null),
  });

  const data: Prisma.EventUpdateInput = { ...merged };
  if (input.title && input.title.trim() !== existing.title) {
    data.slug = await uniqueEventSlug(merged.title, id);
  }
  return prisma.event.update({ where: { id }, data });
}

/**
 * Create the event's chatroom if it doesn't have one yet. Idempotent —
 * `ChatRoom.eventId` is unique, so a re-approval can't spawn a second.
 */
export async function ensureEventRoom(eventId: string): Promise<string | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, slug: true, title: true, countryId: true, chatRoomId: true, summary: true },
  });
  if (!event) return null;
  if (event.chatRoomId) return event.chatRoomId;

  const existing = await prisma.chatRoom.findUnique({
    where: { eventId },
    select: { id: true },
  });
  if (existing) {
    await prisma.event.update({ where: { id: eventId }, data: { chatRoomId: existing.id } });
    return existing.id;
  }

  try {
    const room = await prisma.chatRoom.create({
      data: {
        slug: `event-${event.slug}`.slice(0, 190),
        name: event.title,
        description: event.summary ?? `Coordination and questions for ${event.title}.`,
        tier: "PUBLIC",
        countryId: event.countryId,
        eventId: event.id,
        emoji: "📅",
      },
      select: { id: true },
    });
    await prisma.event.update({ where: { id: eventId }, data: { chatRoomId: room.id } });
    return room.id;
  } catch (err) {
    // A room is a nice-to-have; never fail an approval over it.
    console.warn("[events] could not create event room:", err);
    return null;
  }
}

export async function reviewEvent(
  eventId: string,
  adminId: string,
  action: "approve" | "reject",
  reason?: string,
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, slug: true, title: true, hostUserId: true },
  });
  if (!event) throw new Error("Event not found");

  const status: EventStatus = action === "approve" ? "APPROVED" : "REJECTED";
  const cleanReason = action === "reject" ? clean(reason) : null;

  await prisma.event.update({
    where: { id: eventId },
    data: { status, rejectionReason: cleanReason, reviewedAt: new Date(), reviewedBy: adminId },
  });

  if (action === "approve") await ensureEventRoom(eventId);

  if (event.hostUserId) {
    await createUserNotification({
      userId: event.hostUserId,
      type: action === "approve" ? "EVENT_APPROVED" : "EVENT_REJECTED",
      title: action === "approve" ? "Your event was approved" : "Your event wasn't approved",
      body:
        action === "approve"
          ? `“${event.title}” is now on the events calendar.`
          : cleanReason
            ? `Reason: ${cleanReason}`
            : "It didn't meet our community guidelines.",
      actionUrl: action === "approve" ? `/events/${event.slug}` : "/events",
    });
  }

  return { status };
}

/** Cancel an approved event and tell everyone who RSVP'd. */
export async function cancelEvent(eventId: string, adminId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, slug: true, title: true },
  });
  if (!event) throw new Error("Event not found");

  await prisma.event.update({
    where: { id: eventId },
    data: { status: "CANCELLED", reviewedAt: new Date(), reviewedBy: adminId },
  });

  const rsvps = await prisma.eventRsvp.findMany({
    where: { eventId },
    select: { userId: true },
  });
  await createManyUserNotifications(
    rsvps.map((r) => r.userId),
    {
      type: "EVENT_CANCELLED",
      title: "An event you're going to was cancelled",
      body: `“${event.title}” is no longer happening.`,
      actionUrl: `/events/${event.slug}`,
    },
  );

  return { cancelled: rsvps.length };
}

export async function deleteEvent(id: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    select: { coverUrl: true, photos: true, description: true },
  });

  // RSVPs cascade. The chatroom is left in place deliberately — people
  // may still be talking in it, and orphaning a conversation is worse
  // than an unused room.
  const deleted = await prisma.event.delete({ where: { id } });

  // The cover and gallery are ours to free. `allowAnyOwner` because a
  // member may have submitted the event and an admin is deleting it.
  const photoUrls = Array.isArray(event?.photos)
    ? (event.photos as Array<{ url?: unknown }>).map((p) => (typeof p?.url === "string" ? p.url : null))
    : [];
  await deleteMediaByUrls(
    [event?.coverUrl, ...photoUrls, ...extractLocalImageUrls(event?.description)],
    { allowAnyOwner: true },
  );

  return deleted;
}
