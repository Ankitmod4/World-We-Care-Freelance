/**
 * Seed the events calendar with a handful of realistic gatherings —
 * the kinds of things plan.docx describes: sober socials, shelter
 * volunteering, a hike, a food-bank drive, an online support session.
 *
 * Idempotent: events are upserted by slug, so re-running refreshes
 * them rather than piling up duplicates.
 *
 * Dates are generated relative to NOW so the calendar always has
 * something upcoming, however long after seeding you look at it. One
 * event is deliberately in the past to populate the "Past" tab, and
 * one is left PENDING so the admin review queue isn't empty.
 *
 * Run:
 *   npm run db:seed-events
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** `days` from now, at a given local hour, as a UTC instant. */
function at(days: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const photo = (seed: string) => `https://picsum.photos/seed/${seed}/1200/800`;

interface EventSpec {
  title: string;
  summary: string;
  description: string;
  cover: string;
  photos: string[];
  startDays: number;
  startHour: number;
  durationHours?: number;
  isOnline?: boolean;
  joinUrl?: string;
  venueName?: string;
  addressLine?: string;
  city?: string;
  capacity?: number;
  status?: "APPROVED" | "PENDING";
}

const EVENTS: EventSpec[] = [
  {
    title: "Saturday Morning Sober Coffee",
    summary: "A standing weekly coffee for anyone not drinking — however long it's been.",
    startDays: 3,
    startHour: 10,
    durationHours: 2,
    venueName: "Harbour Lane Coffee House",
    addressLine: "14 Harbour Lane",
    city: "Portland",
    capacity: 20,
    cover: "sober-coffee",
    photos: ["sober-coffee-a", "sober-coffee-b"],
    description: `No speeches, no sharing round the table, no signing anything. Just coffee with people who understand.

## Who it's for

- Anyone sober, however long — day two or year ten
- Anyone sober-curious who wants to see what it looks like
- You don't have to talk. Plenty of people read the room for a few weeks first.

## Finding us

We're at the long table at the back, usually eight to twelve people. Look for the blue notebook on the table.

> "I sat in the car park for twenty minutes the first time. Someone came out and said hello, and that was that."`,
  },
  {
    title: "Dog Walking at Riverside Animal Shelter",
    summary: "Two hours of walking, brushing and general dog admiration. No experience needed.",
    startDays: 6,
    startHour: 9,
    durationHours: 2,
    venueName: "Riverside Animal Shelter",
    addressLine: "88 Mill Road",
    city: "Portland",
    capacity: 12,
    cover: "shelter-dogs",
    photos: ["shelter-dogs-a", "shelter-dogs-b", "shelter-dogs-c"],
    description: `The shelter is short on weekday mornings, so this session exists to fill one.

## What you'll actually do

1. A short walkthrough with a staff member — about ten minutes
2. Walking the dogs who are cleared for volunteers
3. Brushing, water bowls, and a fair amount of laundry

## What to bring

- Shoes you don't mind ruining
- A waterproof, because we go out regardless
- Nothing else — leads, bags and treats are provided

New volunteers shadow someone experienced for the first session. You won't be handed the anxious dogs on day one; that isn't a judgement, it's just that stressed animals need handlers they already know.`,
  },
  {
    title: "Sunrise Hike — Eagle Ridge",
    summary: "An easy 4km loop, out before the heat, back by nine. Dogs and beginners welcome.",
    startDays: 10,
    startHour: 6,
    durationHours: 3,
    venueName: "Eagle Ridge Trailhead",
    city: "Portland",
    capacity: 25,
    cover: "sunrise-hike",
    photos: ["sunrise-hike-a", "sunrise-hike-b"],
    description: `A gentle loop with one moderate climb near the start and a long flat stretch along the ridge. We stop for as long as people need.

## The pace

We walk at the pace of whoever is slowest. Nobody is left behind and nobody is rushed — that's the whole point.

## Bring

- Water, more than you think
- A layer for the top, it's colder up there
- A torch if you're coming from the far car park

Parking fills by 6:15 on clear mornings, so allow a few extra minutes.`,
  },
  {
    title: "Food Bank Restock Evening",
    summary: "Sorting, shelving and packing for two hours. The single most useful evening of the month.",
    startDays: 14,
    startHour: 18,
    durationHours: 2,
    venueName: "St Anne's Community Hall",
    addressLine: "2 Chapel Street",
    city: "Portland",
    capacity: 30,
    cover: "food-bank",
    photos: ["food-bank-a", "food-bank-b"],
    description: `The monthly restock, when the month's donations get sorted, date-checked and shelved.

## What's involved

- Sorting donations into categories
- Checking dates and pulling anything expired
- Packing standard parcels
- Carrying boxes, if you're up for it

## Worth knowing

If you're bringing a donation, the shelves are usually deep in tinned goods and short on **toiletries, period products, nappies and pet food**. A phone call before a big theme saves everyone effort.

Teenagers are welcome with an adult. It's one of the few volunteering evenings where a family can turn up together and all be useful.`,
  },
  {
    title: "Evening Meditation — Online",
    summary: "Twenty minutes of guided practice, cameras optional, no experience required.",
    startDays: 2,
    startHour: 20,
    durationHours: 1,
    isOnline: true,
    joinUrl: "https://meet.example.com/worldwecare-evening-sit",
    capacity: 100,
    cover: "meditation-online",
    photos: ["meditation-online-a"],
    description: `A short guided sit, every week, from wherever you are.

## How it runs

- Five minutes of settling and hellos
- Twenty minutes guided
- Ten minutes at the end for anyone who wants to stay and talk

Cameras and microphones stay off unless you choose otherwise. Plenty of people join, listen, and leave without saying a word — that's a completely normal way to use this.

## If you've never meditated

You are the person this was designed for. You aren't supposed to empty your mind, and noticing you drifted *is* the practice, not a failure at it.`,
  },
  {
    title: "Community Litter Pick — Canal Path",
    summary: "An hour on the towpath with bags, grabbers and better company than you'd expect.",
    startDays: -9,
    startHour: 11,
    durationHours: 1,
    venueName: "Canal Path, Lock 4",
    city: "Portland",
    cover: "litter-pick",
    photos: ["litter-pick-a", "litter-pick-b"],
    description: `A short, cheerful, genuinely useful hour. Equipment provided; just turn up.

We meet at Lock 4 and work east along the towpath as far as we get. Gloves, grabbers and bags are all handed out at the start.`,
  },
  {
    title: "Board Games & Soft Drinks Night",
    summary: "A pub night without the pub part — games, snacks and nothing stronger than lemonade.",
    startDays: 8,
    startHour: 19,
    durationHours: 3,
    venueName: "The Old Library Rooms",
    addressLine: "31 Market Square",
    city: "Portland",
    capacity: 24,
    status: "PENDING",
    cover: "board-games",
    photos: ["board-games-a"],
    description: `Rebuilding a social life without alcohol in the room is harder than people admit — mostly because so much socialising is organised around drinking.

This is the alternative: a long table, a stack of games, decent snacks and a proper soft drinks list.

## What's there

- Everything from Codenames to a six-hour strategy game, if you're brave
- People who'll teach you the rules rather than sigh at you
- No pressure to stay all evening

Bring a game if you have a favourite, or just turn up.`,
  },
];

async function main() {
  const country = await prisma.country.findFirst({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const admin = await prisma.adminUser.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, displayName: true },
  });
  // A real member hosts the community-submitted one, so the pending
  // queue looks like something a person actually sent in.
  const member = await prisma.user.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, displayName: true, avatarUrl: true },
  });

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  let created = 0;
  let updated = 0;

  for (const e of EVENTS) {
    const slug = slugify(e.title);
    const startsAt = at(e.startDays, e.startHour);
    const endsAt = e.durationHours
      ? new Date(startsAt.getTime() + e.durationHours * 3600_000)
      : null;
    const pending = e.status === "PENDING";

    const data = {
      title: e.title,
      summary: e.summary,
      description: e.description,
      coverUrl: photo(e.cover),
      photos: e.photos.map((p) => ({ url: photo(p) })),
      startsAt,
      endsAt,
      timezone,
      isOnline: e.isOnline ?? false,
      joinUrl: e.joinUrl ?? null,
      venueName: e.venueName ?? null,
      addressLine: e.addressLine ?? null,
      city: e.city ?? null,
      countryId: country?.id ?? null,
      capacity: e.capacity ?? null,
      status: (pending ? "PENDING" : "APPROVED") as "PENDING" | "APPROVED",
      hostUserId: pending ? member?.id ?? null : null,
      hostNameSnapshot: pending
        ? member?.displayName ?? "A community member"
        : admin?.displayName ?? "WorldWeCare Team",
      hostAvatarSnapshot: pending ? member?.avatarUrl ?? null : null,
      createdByAdminId: pending ? null : admin?.id ?? null,
      reviewedAt: pending ? null : new Date(),
      reviewedBy: pending ? null : admin?.id ?? null,
    };

    const existing = await prisma.event.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      await prisma.event.update({ where: { slug }, data });
      updated += 1;
    } else {
      await prisma.event.create({ data: { slug, ...data } });
      created += 1;
    }
  }

  const upcoming = EVENTS.filter((e) => e.startDays >= 0 && e.status !== "PENDING").length;
  console.log(`Done. ${created} created, ${updated} updated.`);
  console.log(
    `${upcoming} upcoming · 1 past · 1 waiting for review${country ? ` · scoped to ${country.name}` : " · no country set"}`,
  );
  if (!country) console.log("Tip: run `npm run db:seed-geo` first so events get a country.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
