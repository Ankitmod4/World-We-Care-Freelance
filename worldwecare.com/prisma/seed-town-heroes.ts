/**
 * Town Heroes — the categories, and a few people to look at.
 *
 *   npm run db:seed-town-heroes            categories + sample heroes
 *   npm run db:seed-town-hero-categories   categories only
 *
 * ONE FILE, BECAUSE THE HEROES CANNOT EXIST WITHOUT THE CATEGORIES.
 * `TownHero.categoryId` is required, so seeding heroes from a separate
 * script meant a run order you had to know about and a failure if you
 * got it wrong. The categories are defined here and created first;
 * running this twice is safe.
 *
 * THE PEOPLE ARE INVENTED. Every name below is fictional and the
 * photos are random stock from Lorem Picsum, the same source the
 * article seed uses. That matters more here than anywhere else in the
 * project: a Town Hero is a REAL NAMED PERSON, and seeding a
 * production database with a plausible-looking stranger attached to a
 * stock photo of somebody who never consented is exactly what this
 * feature has to be careful about. The names are suffixed "(sample)"
 * and the bodies say so.
 *
 * THE HEROES ARE SEEDED AS APPROVED, which puts them straight onto the
 * public page with no moderator. That is right for a demo database and
 * wrong for production. Both halves skip anything that already exists,
 * so re-running is safe, but it will not undo a previous run.
 *
 * Pass `--categories-only` to create the taxonomy and no people —
 * which is what you want on a real deployment.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categoriesOnly = process.argv.includes("--categories-only");

/* ── the taxonomy ────────────────────────────────────────────── */

interface CategorySpec {
  slug: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  sortOrder: number;
}

const CATEGORIES: CategorySpec[] = [
  {
    slug: "food-and-meals",
    name: "Food & meals",
    description: "Soup runs, food banks, community kitchens, the people who cook for others.",
    emoji: "🍲",
    color: "#f59e0b",
    sortOrder: 10,
  },
  {
    slug: "checking-in",
    name: "Checking in",
    description: "The ones who knock, ring, and notice when somebody has gone quiet.",
    emoji: "☎️",
    color: "#0ea5e9",
    sortOrder: 20,
  },
  {
    slug: "lifts-and-errands",
    name: "Lifts & errands",
    description: "Driving people to appointments, collecting prescriptions, carrying the shopping.",
    emoji: "🚗",
    color: "#10b981",
    sortOrder: 30,
  },
  {
    slug: "animals",
    name: "Animals",
    description: "Fostering, rescuing, walking other people's dogs when they can't.",
    emoji: "🐾",
    color: "#8b5cf6",
    sortOrder: 40,
  },
  {
    slug: "young-people",
    name: "Young people",
    description: "Homework clubs, youth groups, coaching, the adult a teenager can talk to.",
    emoji: "🎒",
    color: "#ec4899",
    sortOrder: 50,
  },
  {
    slug: "recovery-and-support",
    name: "Recovery & support",
    description: "Running meetings, answering the phone at 2am, sitting with someone.",
    emoji: "🌱",
    color: "#14b8a6",
    sortOrder: 60,
  },
  {
    slug: "neighbourhood",
    name: "Neighbourhood",
    description: "Litter picks, gardens, repairs, the person who keeps the place standing.",
    emoji: "🧹",
    color: "#64748b",
    sortOrder: 70,
  },
  {
    /**
     * THE CATCH-ALL, AND IT IS NOT OPTIONAL.
     *
     * A category is required on every nomination, so the picker has to
     * have a right answer for the person whose neighbour does
     * something none of the boxes above describe. Without this, the
     * requirement quietly becomes "only nominate people who fit our
     * list", and the form gets abandoned instead. Keep it last; keep
     * it active.
     */
    slug: "anything-else",
    name: "Anything else",
    description: "Everything that doesn't fit a box above — tell us what they do.",
    emoji: "✨",
    color: "#94a3b8",
    sortOrder: 999,
  },
];

/* ── the people ──────────────────────────────────────────────── */

const photo = (seed: string) => `https://picsum.photos/seed/${seed}/900/675`;

interface HeroSpec {
  slug: string;
  heroName: string;
  /** Slug from CATEGORIES above. */
  category: string;
  town: string;
  summary: string;
  body: string;
  photoSeed: string;
  featured?: boolean;
}

const HEROES: HeroSpec[] = [
  {
    slug: "sample-marie-o-donnell",
    heroName: "Marie O'Donnell (sample)",
    category: "food-and-meals",
    town: "Cork",
    summary: "Runs the Tuesday soup run, rain or shine.",
    body:
      "Marie has been out with the soup run every Tuesday for eleven years. She started with a flask and a bag of rolls and now there are six of them, and a van.\n\nWhat people mention first is not the food. It's that she remembers names, and she asks how the thing you told her about last week went.\n\n*This is placeholder content for testing the Town Heroes page.*",
    photoSeed: "wwc-hero-1",
    featured: true,
  },
  {
    slug: "sample-danny-whelan",
    heroName: "Danny Whelan (sample)",
    category: "animals",
    town: "Limerick",
    summary: "Walks other people's dogs when they're too unwell to.",
    body:
      "Danny put a card up in the pharmacy offering to walk dogs for anyone stuck indoors. He thought he'd get one or two.\n\nHe now has a rota, three volunteers, and a rule he repeats to everyone who joins: you're there for the person, the dog is the excuse.\n\n*This is placeholder content for testing the Town Heroes page.*",
    photoSeed: "wwc-hero-2",
  },
  {
    slug: "sample-aisha-rahman",
    heroName: "Aisha Rahman (sample)",
    category: "young-people",
    town: "Galway",
    summary: "Set up the after-school homework club at the library.",
    body:
      "Aisha noticed the same handful of kids sitting in the library until closing because home was too loud to work in. She asked the librarian for a table.\n\nTwo years later it's twenty-odd children, four volunteers and a biscuit budget. She still does Thursdays herself.\n\n*This is placeholder content for testing the Town Heroes page.*",
    photoSeed: "wwc-hero-3",
  },
  {
    slug: "sample-eileen-brady",
    heroName: "Eileen Brady (sample)",
    category: "checking-in",
    town: "Sligo",
    summary: "Rings the same eleven people every Sunday morning.",
    body:
      "Eileen started ringing round during a bad winter when the buses stopped. She never stopped.\n\nEleven calls, every Sunday, in the same order. Two of them have told her it is the only conversation they have all week.\n\n*This is placeholder content for testing the Town Heroes page.*",
    photoSeed: "wwc-hero-4",
  },
];

async function main() {
  /* categories first — the heroes cannot exist without them */
  let catCreated = 0;
  let catRefreshed = 0;

  for (const spec of CATEGORIES) {
    const existing = await prisma.townHeroCategory.findUnique({
      where: { slug: spec.slug },
      select: { id: true, emoji: true, color: true },
    });

    if (existing) {
      await prisma.townHeroCategory.update({
        where: { id: existing.id },
        data: {
          name: spec.name,
          description: spec.description,
          sortOrder: spec.sortOrder,
          // Fill blanks only. Never overwrite a colour somebody chose,
          // and never re-enable a category they turned off.
          emoji: existing.emoji ?? spec.emoji,
          color: existing.color ?? spec.color,
        },
      });
      catRefreshed += 1;
      console.log(`  category  refreshed  ${spec.slug}`);
      continue;
    }

    await prisma.townHeroCategory.create({
      data: { ...spec, isActive: true },
    });
    catCreated += 1;
    console.log(`  category  created    ${spec.slug}`);
  }

  console.log(`\n${catCreated} categories created, ${catRefreshed} refreshed.`);

  if (categoriesOnly) {
    console.log("\n--categories-only: no sample people were created.");
    return;
  }

  /* then the people */
  let added = 0;
  let kept = 0;

  for (const spec of HEROES) {
    const existing = await prisma.townHero.findUnique({
      where: { slug: spec.slug },
      select: { id: true },
    });
    if (existing) {
      kept += 1;
      console.log(`  hero      kept       ${spec.slug}`);
      continue;
    }

    const category = await prisma.townHeroCategory.findUnique({
      where: { slug: spec.category },
      select: { id: true },
    });
    if (!category) {
      // Can't happen — the loop above just created it — but a required
      // FK is worth being explicit about rather than throwing a
      // constraint error nobody can read.
      console.log(`  hero      SKIPPED    ${spec.slug} (no category "${spec.category}")`);
      continue;
    }

    await prisma.townHero.create({
      data: {
        slug: spec.slug,
        heroName: spec.heroName,
        categoryId: category.id,
        town: spec.town,
        summary: spec.summary,
        body: spec.body,
        photoUrl: photo(spec.photoSeed),
        photoAlt: "Placeholder photograph",
        // No nominator: these were not nominated by a member, and
        // inventing one would put a real member's name on a made-up
        // submission. The page reads "Nominated by a member" when this
        // is null, which is the honest answer for a seeded row.
        nominatedByUserId: null,
        nominatorSnapshot: null,
        isAnonymous: false,
        status: "APPROVED",
        approvedAt: new Date(),
        isFeatured: !!spec.featured,
        featuredAt: spec.featured ? new Date() : null,
      },
    });
    added += 1;
    console.log(`  hero      added      ${spec.slug}`);
  }

  console.log(`\n${added} people added, ${kept} left alone.`);
  if (added > 0) {
    console.log(
      "\nThese are INVENTED people with random stock photos, seeded as APPROVED so the\n" +
        "page has something on it. Delete them from Admin → Town Heroes before this\n" +
        "database is used for anything real, or seed with --categories-only next time.",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
