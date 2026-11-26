/**
 * Seed the map and directory.
 *
 * ────────────────────────────────────────────────────────────────
 * THIS SEED SUPPLIES ITS OWN COORDINATES AND NEVER GEOCODES.
 *
 * Two reasons, both of which matter:
 *
 *  1. These are invented addresses. Nominatim would fail to match
 *     most of them and the map would come out empty — the seed would
 *     take a minute to run and produce nothing to look at.
 *  2. The public geocoder allows about one request a second and is
 *     run on donated hardware. Spending a dozen of those on fictional
 *     addresses is precisely the kind of thing its usage policy asks
 *     people not to do.
 *
 * Real places added through the admin form geocode normally. Seed
 * data does not.
 * ────────────────────────────────────────────────────────────────
 *
 * The bulk sits around Leeds so the map has a coherent place to open
 * onto, with a spread across other UK cities so there is something to
 * see at national zoom. Coordinates are approximate but land in the
 * right part of the right city.
 *
 * Idempotent: places are upserted by slug.
 *
 * Run:
 *   npm run db:seed-places
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

type Hours = Array<{ day: number; opens?: string; closes?: string; closed?: boolean }>;

const weekdays = (opens: string, closes: string): Hours =>
  [1, 2, 3, 4, 5].map((day) => ({ day, opens, closes }));

interface SeedPlace {
  name: string;
  type:
    | "RECOVERY_PROGRAM" | "CLINIC" | "COUNSELLING" | "CHURCH" | "FOOD_BANK"
    | "ANIMAL_SHELTER" | "SHELTER" | "COMMUNITY_CENTRE" | "DONATING_BUSINESS" | "OTHER";
  summary: string;
  about?: string;
  addressLine: string;
  city: string;
  postcode: string;
  latitude: number;
  longitude: number;
  phone?: string;
  website?: string;
  needs?: string;
  hours?: Hours;
  isDonor?: boolean;
  status?: "PENDING" | "APPROVED" | "REJECTED" | "CLOSED";
  submitterSnapshot?: string;
}

const PLACES: SeedPlace[] = [
  {
    name: "Riverside Recovery Hub",
    type: "RECOVERY_PROGRAM",
    summary: "Drop-in and structured programs. No referral, no waiting list.",
    about:
      "## Who it's for\n\nAnyone trying to stop, cut down, or work out whether they have a problem at all. You do not need a diagnosis and you do not need to have hit anything anyone would call rock bottom.\n\n### What happens\n\n- Drop-in every weekday afternoon — turn up, no appointment\n- A twelve-week structured program starting the first Monday of each month\n- One-to-one keyworker sessions once you're in\n\n> The kettle is always on. Nobody will make you talk on your first visit.",
    addressLine: "14 Kirkstall Road",
    city: "Leeds",
    postcode: "LS3 1LX",
    latitude: 53.7989,
    longitude: -1.5641,
    phone: "0113 496 0141",
    website: "https://example.org/riverside-recovery",
    needs: "Volunteer drivers on weekday afternoons. Instant coffee, always.",
    hours: [...weekdays("10:00", "18:00"), { day: 6, opens: "10:00", closes: "14:00" }, { day: 0, closed: true }],
  },
  {
    name: "Hyde Park Community Clinic",
    type: "CLINIC",
    summary: "NHS walk-in with a substance-use nurse on Tuesdays and Thursdays.",
    addressLine: "88 Woodhouse Lane",
    city: "Leeds",
    postcode: "LS2 9DS",
    latitude: 53.8067,
    longitude: -1.5556,
    phone: "0113 496 0288",
    needs: "Nothing right now — just come in.",
    hours: weekdays("08:00", "20:00"),
  },
  {
    name: "The Listening Room",
    type: "COUNSELLING",
    summary: "Low-cost counselling, sliding scale from £5. Six-week waiting list.",
    about:
      "Qualified and trainee counsellors, supervised. The sliding scale starts at £5 and nobody is asked to prove income.\n\n**Crisis is not what this is for** — if today is the emergency, ring 111 or go to A&E.",
    addressLine: "2 Blenheim Terrace",
    city: "Leeds",
    postcode: "LS2 9HN",
    latitude: 53.8085,
    longitude: -1.5528,
    phone: "0113 496 0322",
    website: "https://example.org/listening-room",
    needs: "Qualified counsellors able to give two hours a week.",
    hours: [...weekdays("09:00", "21:00"), { day: 6, opens: "09:00", closes: "13:00" }],
  },
  {
    name: "St Aidan's Parish Hall",
    type: "CHURCH",
    summary: "Warm room every afternoon through winter. Everyone welcome, no service required.",
    addressLine: "Roundhay Road",
    city: "Leeds",
    postcode: "LS8 5AL",
    latitude: 53.8168,
    longitude: -1.5215,
    phone: "0113 496 0455",
    needs: "Bags of coffee, long-life milk, and someone who can fix a boiler.",
    hours: [{ day: 0, opens: "09:00", closes: "16:00" }, ...weekdays("13:00", "17:00")],
  },
  {
    name: "Kirkgate Food Bank",
    type: "FOOD_BANK",
    summary: "Parcels without a voucher on Wednesdays. Everything else needs a referral.",
    about:
      "## What we're short of\n\nWe are never short of pasta. What runs out is everything else:\n\n- Tinned fish and tinned meat\n- Cooking oil\n- Nappies, sizes 4 and up\n- Period products\n- Washing powder\n- Anything edible without a cooker",
    addressLine: "31 New York Street",
    city: "Leeds",
    postcode: "LS2 7DR",
    latitude: 53.7963,
    longitude: -1.5385,
    phone: "0113 496 0511",
    needs: "Tinned fish, cooking oil, nappies size 4+, period products, washing powder.",
    hours: [
      { day: 1, opens: "10:00", closes: "15:00" },
      { day: 3, opens: "10:00", closes: "18:00" },
      { day: 5, opens: "10:00", closes: "15:00" },
    ],
  },
  {
    name: "Armley Dog & Cat Rescue",
    type: "ANIMAL_SHELTER",
    summary: "Rehoming and two-week fostering. Food and vet care covered.",
    addressLine: "Town Street",
    city: "Leeds",
    postcode: "LS12 3AA",
    latitude: 53.7936,
    longitude: -1.6098,
    phone: "0113 496 0677",
    website: "https://example.org/armley-rescue",
    needs: "Foster homes for a fortnight. Old towels and blankets, always.",
    hours: [...weekdays("11:00", "16:00"), { day: 6, opens: "10:00", closes: "16:00" }],
  },
  {
    name: "Beckett Street Night Shelter",
    type: "SHELTER",
    summary: "28 beds from 8pm. Ring first — they fill by early evening in winter.",
    addressLine: "Beckett Street",
    city: "Leeds",
    postcode: "LS9 7LN",
    latitude: 53.8036,
    longitude: -1.5245,
    phone: "0113 496 0733",
    needs: "Sleeping bags, men's socks, and volunteers on the 8pm–midnight shift.",
    hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, opens: "20:00", closes: "08:00" })),
  },
  {
    name: "Chapeltown Community Centre",
    type: "COMMUNITY_CENTRE",
    summary: "Rooms, a kitchen, and eleven groups a week including two sober socials.",
    addressLine: "Chapeltown Road",
    city: "Leeds",
    postcode: "LS7 3DP",
    latitude: 53.8231,
    longitude: -1.5361,
    phone: "0113 496 0810",
    needs: "Someone to run a Saturday morning session — the room is free.",
    hours: [...weekdays("09:00", "22:00"), { day: 6, opens: "10:00", closes: "18:00" }, { day: 0, closed: true }],
  },
  {
    name: "Meanwood Coffee House",
    type: "DONATING_BUSINESS",
    summary: "Suspended coffee scheme — pay for one, leave one on the board.",
    addressLine: "6 Green Road",
    city: "Leeds",
    postcode: "LS6 4JP",
    latitude: 53.8341,
    longitude: -1.5613,
    website: "https://example.org/meanwood-coffee",
    isDonor: true,
    needs: "Nothing — buy a coffee and leave one for someone.",
    hours: [...weekdays("07:30", "17:00"), { day: 6, opens: "08:00", closes: "17:00" }, { day: 0, opens: "09:00", closes: "15:00" }],
  },
  {
    name: "Hyde Park Bookshop",
    type: "DONATING_BUSINESS",
    summary: "10% of Sunday takings goes to the night shelter. Also a warm place to sit.",
    addressLine: "24 Headingley Lane",
    city: "Leeds",
    postcode: "LS6 2BU",
    latitude: 53.8158,
    longitude: -1.5698,
    isDonor: true,
    hours: [...weekdays("09:00", "18:00"), { day: 6, opens: "09:00", closes: "18:00" }, { day: 0, opens: "11:00", closes: "16:00" }],
  },
  {
    name: "Bramley Sunday Breakfast",
    type: "FOOD_BANK",
    summary: "Hot breakfast every Sunday, 8–11am. No questions, no forms.",
    addressLine: "Hough Lane",
    city: "Leeds",
    postcode: "LS13 3NE",
    latitude: 53.8047,
    longitude: -1.6362,
    needs: "Eggs, bread, and two more pairs of hands from 7am.",
    hours: [{ day: 0, opens: "08:00", closes: "11:00" }],
    // Left unreviewed on purpose so the admin queue isn't empty.
    status: "PENDING",
    submitterSnapshot: "Priya",
  },
  {
    name: "Holbeck Drop-In",
    type: "COMMUNITY_CENTRE",
    summary: "Closed since March. The Tuesday group moved to Chapeltown.",
    addressLine: "Domestic Street",
    city: "Leeds",
    postcode: "LS11 9RP",
    latitude: 53.7861,
    longitude: -1.5623,
    // Kept rather than deleted, so nobody turns up to a locked door.
    status: "CLOSED",
  },

  // ── Beyond Leeds ──────────────────────────────────────────────
  // Enough spread that the map has something on it at national zoom
  // instead of one lonely cluster in West Yorkshire. Coordinates are
  // real to the neighbourhood; the organisations are invented.

  {
    name: "Whitechapel Recovery Rooms",
    type: "RECOVERY_PROGRAM",
    summary: "Evening meetings six nights a week. Walk in, sit at the back if you like.",
    about:
      "## Meetings\n\nSix nights a week, 7pm, upstairs. No sign-in sheet and no one takes a register.\n\n### Also here\n\n- A Thursday family group for people living with someone else's drinking\n- Keywork sessions by appointment\n- Free tea, biscuits of variable quality",
    addressLine: "119 Whitechapel Road",
    city: "London",
    postcode: "E1 1DT",
    latitude: 51.5171,
    longitude: -0.0597,
    phone: "020 7946 0101",
    website: "https://example.org/whitechapel-recovery",
    needs: "Chairs. Genuinely — we are twelve short on Thursdays.",
    hours: [...weekdays("18:00", "21:30"), { day: 6, opens: "18:00", closes: "21:30" }, { day: 0, closed: true }],
  },
  {
    name: "Rye Lane Food Bank",
    type: "FOOD_BANK",
    summary: "Vouchers Monday to Thursday. Fresh veg on Fridays, first come first served.",
    addressLine: "Rye Lane",
    city: "London",
    postcode: "SE15 4ST",
    latitude: 51.4712,
    longitude: -0.0692,
    phone: "020 7946 0233",
    needs: "Halal tinned meat, rice in 1kg bags, and anything for a baby.",
    hours: [
      { day: 1, opens: "10:00", closes: "16:00" },
      { day: 2, opens: "10:00", closes: "16:00" },
      { day: 3, opens: "10:00", closes: "16:00" },
      { day: 4, opens: "10:00", closes: "16:00" },
      { day: 5, opens: "12:00", closes: "14:00" },
    ],
  },
  {
    name: "King's Cross Night Shelter",
    type: "SHELTER",
    summary: "40 beds, doors at 7.30pm. Assistance dogs welcome; other dogs kennelled next door.",
    addressLine: "Caledonian Road",
    city: "London",
    postcode: "N1 9DX",
    latitude: 51.5308,
    longitude: -0.1238,
    phone: "020 7946 0377",
    needs: "Men's socks, size 9–11 trainers, and phone chargers of every kind.",
    hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, opens: "19:30", closes: "08:30" })),
  },
  {
    name: "Ancoats Wellbeing Clinic",
    type: "CLINIC",
    summary: "GP-led, with a substance-use nurse on Mondays and a blood-borne virus clinic Thursdays.",
    addressLine: "Great Ancoats Street",
    city: "Manchester",
    postcode: "M4 5AB",
    latitude: 53.4839,
    longitude: -2.2231,
    phone: "0161 496 0144",
    website: "https://example.org/ancoats-wellbeing",
    hours: weekdays("08:30", "18:30"),
  },
  {
    name: "Moss Side Community Centre",
    type: "COMMUNITY_CENTRE",
    summary: "Fourteen groups a week, a free laundry, and a hall you can book for nothing.",
    addressLine: "Claremont Road",
    city: "Manchester",
    postcode: "M14 4TJ",
    latitude: 53.4525,
    longitude: -2.2497,
    phone: "0161 496 0288",
    needs: "A volunteer who can keep the laundry rota straight.",
    hours: [...weekdays("09:00", "21:00"), { day: 6, opens: "10:00", closes: "17:00" }, { day: 0, closed: true }],
  },
  {
    name: "Digbeth Dog Rescue",
    type: "ANIMAL_SHELTER",
    summary: "Rehoming, plus emergency boarding when someone goes into treatment or refuge.",
    about:
      "If you are going into rehab, hospital, or a refuge and the only thing stopping you is the dog — ring us. Boarding is free for up to twelve weeks and the dog comes back to you.",
    addressLine: "Adderley Street",
    city: "Birmingham",
    postcode: "B9 4ED",
    latitude: 52.4750,
    longitude: -1.8828,
    phone: "0121 496 0311",
    website: "https://example.org/digbeth-rescue",
    needs: "Foster homes, old duvets, and a van driver on Saturdays.",
    hours: [...weekdays("10:00", "16:00"), { day: 6, opens: "10:00", closes: "16:00" }],
  },
  {
    name: "Sparkhill Counselling Collective",
    type: "COUNSELLING",
    summary: "Free for the first six sessions. Urdu, Punjabi, Somali and Polish speakers on the team.",
    addressLine: "Stratford Road",
    city: "Birmingham",
    postcode: "B11 4EA",
    latitude: 52.4459,
    longitude: -1.8563,
    phone: "0121 496 0455",
    needs: "Counsellors with a second language. Interpreters for one-off sessions.",
    hours: [...weekdays("10:00", "20:00"), { day: 6, opens: "10:00", closes: "14:00" }],
  },
  {
    name: "Govanhill Recovery Café",
    type: "RECOVERY_PROGRAM",
    summary: "Open every evening a pub is. Coffee, cards, and nobody asking what you're here for.",
    about:
      "The café opens at 6pm and closes at midnight, seven days, because those are the hours that are hard.\n\n**No membership, no referral, no cost.** Bring someone if you want.",
    addressLine: "Victoria Road",
    city: "Glasgow",
    postcode: "G42 7AA",
    latitude: 55.8332,
    longitude: -4.2620,
    phone: "0141 496 0512",
    website: "https://example.org/govanhill-cafe",
    needs: "Volunteers for the 9pm–midnight shift. Board games that still have all the pieces.",
    hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, opens: "18:00", closes: "23:59" })),
  },
  {
    name: "Leith Harbour Church",
    type: "CHURCH",
    summary: "Warm space Monday to Friday, soup at one, and a recovery group on Wednesday nights.",
    addressLine: "Constitution Street",
    city: "Edinburgh",
    postcode: "EH6 7BG",
    latitude: 55.9758,
    longitude: -3.1710,
    phone: "0131 496 0623",
    needs: "Tinned soup, long-life milk, and a hand with the washing up.",
    hours: [...weekdays("10:00", "16:00"), { day: 0, opens: "09:30", closes: "12:30" }],
  },
  {
    name: "Splott Community Kitchen",
    type: "FOOD_BANK",
    summary: "Pay-what-you-can hot meals Tuesday and Friday. Parcels on the way out.",
    addressLine: "Splott Road",
    city: "Cardiff",
    postcode: "CF24 2BW",
    latitude: 51.4780,
    longitude: -3.1560,
    phone: "029 2018 0744",
    needs: "Cooking oil, tinned tomatoes, and drivers for the Friday delivery round.",
    hours: [
      { day: 2, opens: "12:00", closes: "19:00" },
      { day: 5, opens: "12:00", closes: "19:00" },
    ],
  },
  {
    name: "Bedminster Bike Works",
    type: "DONATING_BUSINESS",
    summary: "Every third bike sold funds a free one. Repairs free for anyone out of work.",
    addressLine: "North Street",
    city: "Bristol",
    postcode: "BS3 1JJ",
    latitude: 51.4402,
    longitude: -2.5967,
    website: "https://example.org/bedminster-bikes",
    isDonor: true,
    needs: "Unloved bikes in any state. We strip what we can't fix.",
    hours: [...weekdays("09:00", "18:00"), { day: 6, opens: "09:00", closes: "17:00" }, { day: 0, closed: true }],
  },
  {
    name: "Byker Drop-In",
    type: "COMMUNITY_CENTRE",
    summary: "Advice desk, free wifi, and a phone you can use for as long as you need.",
    addressLine: "Raby Street",
    city: "Newcastle upon Tyne",
    postcode: "NE6 2LA",
    latitude: 54.9740,
    longitude: -1.5808,
    phone: "0191 496 0855",
    needs: "Someone who understands Universal Credit well enough to explain it.",
    hours: [...weekdays("09:30", "16:30"), { day: 6, opens: "10:00", closes: "13:00" }],
  },
  {
    name: "Toxteth Family Shelter",
    type: "SHELTER",
    summary: "Twelve family rooms. Referral through the council, but ring us first either way.",
    addressLine: "Princes Road",
    city: "Liverpool",
    postcode: "L8 1TG",
    latitude: 53.3866,
    longitude: -2.9660,
    phone: "0151 496 0966",
    needs: "Cots, pushchairs, and school uniform in every size.",
    hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, opens: "00:00", closes: "23:59" })),
  },
  {
    name: "Falls Road Listening Post",
    type: "COUNSELLING",
    summary: "Free one-to-one sessions, no waiting list, two evenings and one morning a week.",
    addressLine: "Falls Road",
    city: "Belfast",
    postcode: "BT12 6AB",
    latitude: 54.5920,
    longitude: -5.9560,
    phone: "028 9018 0177",
    needs: "A second counsellor so we can open on Fridays.",
    hours: [
      { day: 2, opens: "17:00", closes: "21:00" },
      { day: 4, opens: "17:00", closes: "21:00" },
      { day: 6, opens: "09:00", closes: "13:00" },
    ],
  },
  {
    name: "Sheffield Sunday Soup Run",
    type: "FOOD_BANK",
    summary: "A van outside the station, 7pm every Sunday, until it's empty.",
    addressLine: "Sheaf Square",
    city: "Sheffield",
    postcode: "S1 2BP",
    latitude: 53.3781,
    longitude: -1.4620,
    needs: "Flasks, cup-a-soups, and two people to help hand out.",
    hours: [{ day: 0, opens: "19:00", closes: "21:00" }],
    // Second unreviewed entry, so the admin queue has more than one row.
    status: "PENDING",
    submitterSnapshot: "Dan",
  },
];

async function main() {
  console.log("Seeding places…\n");

  const uk = await prisma.country.findFirst({
    where: { OR: [{ code: "GB" }, { name: { contains: "United Kingdom" } }] },
    select: { id: true, name: true },
  });
  if (uk) console.log(`  Scoping to ${uk.name}.\n`);
  else console.log("  No United Kingdom row found — places will be global.\n");

  let created = 0;
  for (const p of PLACES) {
    const slug = slugify(p.name);
    const data = {
      name: p.name,
      type: p.type,
      summary: p.summary,
      about: p.about ?? null,
      addressLine: p.addressLine,
      city: p.city,
      postcode: p.postcode,
      countryId: uk?.id ?? null,
      // Supplied, not looked up — see the header comment.
      latitude: p.latitude,
      longitude: p.longitude,
      geocodedAt: new Date(),
      geocodeError: null,
      phone: p.phone ?? null,
      website: p.website ?? null,
      needs: p.needs ?? null,
      hours: (p.hours ?? []) as object,
      isDonor: p.isDonor ?? false,
      status: p.status ?? ("APPROVED" as const),
      submitterSnapshot: p.submitterSnapshot ?? null,
      reviewedAt: p.status === "PENDING" ? null : new Date(),
    };

    const place = await prisma.place.upsert({
      where: { slug },
      create: { ...data, slug },
      update: data,
      select: { id: true, name: true, status: true },
    });
    created += 1;

    // Approved places get their chatroom, the same way approval does.
    if (place.status === "APPROVED") {
      const existing = await prisma.chatRoom.findUnique({
        where: { placeId: place.id },
        select: { id: true },
      });
      if (!existing) {
        const room = await prisma.chatRoom.create({
          data: {
            slug: `place-${slug}`.slice(0, 190),
            name: place.name,
            description: p.summary,
            tier: "PUBLIC",
            countryId: uk?.id ?? null,
            placeId: place.id,
            emoji: "📍",
          },
          select: { id: true },
        });
        await prisma.place.update({ where: { id: place.id }, data: { chatRoomId: room.id } });
      }
    }

    console.log(`  ${place.status.padEnd(8)} ${place.name}`);
  }

  console.log(`\nDone: ${created} places across the UK. Nothing was geocoded.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
