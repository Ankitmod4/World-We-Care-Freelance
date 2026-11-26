/**
 * Seed the LibraryTheme themes with a starter set of clips.
 *
 * Idempotent: themes are upserted by slug and clips by (theme, title),
 * so re-running refreshes them rather than piling up duplicates.
 *
 * Every clip here is an EMBED — nothing is hosted, transcoded or paid
 * for by the seed. Upload clips are created through the admin screen,
 * because they need a real file to convert.
 *
 * The URLs are well-known, long-lived, freely embeddable talks and
 * sessions. If one ever goes away the clip still renders: the reader
 * gets the card, and the modal falls back to a link.
 *
 * Run:
 *   npm run db:seed-theme
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

interface SeedClip {
  title: string;
  caption: string;
  embedUrl: string;
}

interface SeedTheme {
  name: string;
  emoji: string;
  tagline: string;
  about: string;
  clips: SeedClip[];
}

const THEMES: SeedTheme[] = [
  {
    name: "Movement",
    emoji: "🏃",
    tagline: "Exercise as something you get to do, not something you owe.",
    about:
      "Short clips about moving your body in a way that lifts the day — walking, stretching, breathing, lifting. **No transformation photos, no shame.**\n\nIf a clip makes you feel behind rather than invited, it doesn't belong here.",
    clips: [
      {
        title: "A ten-minute walk, and what it does",
        caption: "The smallest useful dose of movement, and why it counts.",
        embedUrl: "https://www.youtube.com/watch?v=aUaInS6HIGo",
      },
      {
        title: "Breathing that settles the nervous system",
        caption: "Two minutes, sitting down, no equipment.",
        embedUrl: "https://www.youtube.com/watch?v=tEmt1Znux58",
      },
      {
        title: "Starting again after a long gap",
        caption: "On going back to something you used to be good at.",
        embedUrl: "https://www.youtube.com/watch?v=inpok4MKVLM",
      },
    ],
  },
  {
    name: "Recovery",
    emoji: "🌱",
    tagline: "Honest accounts of getting through — one day, then the next.",
    about:
      "Talks and stories from people further along, and from people right in the middle of it.\n\n> Nothing here promises it's easy. That's the point.",
    clips: [
      {
        title: "The opposite of addiction is connection",
        caption: "Johann Hari on why isolation, not the substance, is the engine.",
        embedUrl: "https://www.youtube.com/watch?v=PY9DcIMGxMs",
      },
      {
        title: "What shame does, and how it works",
        caption: "Brené Brown on the difference between guilt and shame.",
        embedUrl: "https://www.youtube.com/watch?v=psN1DORYYV0",
      },
      {
        title: "Asking for help is a skill",
        caption: "Not a weakness, and not something people are born knowing.",
        embedUrl: "https://www.youtube.com/watch?v=-4EDhdAHrOg",
      },
    ],
  },
  {
    name: "Stillness",
    emoji: "🕊️",
    tagline: "Spirituality, meditation, and sitting with what's there.",
    about:
      "Whatever you call it — prayer, meditation, a quiet ten minutes — this is the room for it. Open to every tradition and to none.",
    clips: [
      {
        title: "All it takes is ten mindful minutes",
        caption: "Andy Puddicombe on doing nothing, properly.",
        embedUrl: "https://www.youtube.com/watch?v=qzR62JJCMBQ",
      },
      {
        title: "Where does a thought come from?",
        caption: "A short talk on watching the mind rather than obeying it.",
        embedUrl: "https://www.youtube.com/watch?v=w6T02g5hnT4",
      },
    ],
  },
  {
    name: "Kindness",
    emoji: "💛",
    tagline: "People being decent to each other, at scale and one at a time.",
    about:
      "Proof, on the days you need it, that most people are trying.",
    clips: [
      {
        title: "The power of small acts",
        caption: "What one ordinary gesture sets off.",
        embedUrl: "https://www.youtube.com/watch?v=nwAYpLVyeFU",
      },
      {
        title: "Everybody needs somebody in their corner",
        caption: "Rita Pierson on the adult who decides a child matters.",
        embedUrl: "https://www.youtube.com/watch?v=SFnMTHhKdkw",
      },
    ],
  },
  {
    name: "Nature",
    emoji: "🌤️",
    tagline: "Weather, water, animals, and the outside of the window.",
    about: "No commentary needed. Put it on and let it run.",
    clips: [
      {
        title: "Rain on a window, one hour",
        caption: "For working, sleeping, or just not being in silence.",
        embedUrl: "https://www.youtube.com/watch?v=mPZkdNFkNps",
      },
      {
        title: "How wolves change rivers",
        caption: "One species returns to Yellowstone and the landscape moves.",
        embedUrl: "https://www.youtube.com/watch?v=ysa5OBhXz-Q",
      },
    ],
  },
];

async function main() {
  console.log("Seeding theme themes…");
  let themeCount = 0;
  let clipCount = 0;

  for (const [index, theme] of THEMES.entries()) {
    const slug = slugify(theme.name);
    const row = await prisma.libraryTheme.upsert({
      where: { slug },
      create: {
        slug,
        name: theme.name,
        emoji: theme.emoji,
        tagline: theme.tagline,
        about: theme.about,
        sortOrder: index,
        isActive: true,
      },
      update: {
        name: theme.name,
        emoji: theme.emoji,
        tagline: theme.tagline,
        about: theme.about,
        sortOrder: index,
      },
      select: { id: true, name: true },
    });
    themeCount += 1;

    for (const [i, clip] of theme.clips.entries()) {
      // No unique constraint on (themeId, title) — the schema
      // shouldn't carry one just for the seed — so match by hand.
      const existing = await prisma.clip.findFirst({
        where: { themeId: row.id, title: clip.title },
        select: { id: true },
      });
      const data = {
        title: clip.title,
        caption: clip.caption,
        kind: "EMBED" as const,
        embedUrl: clip.embedUrl,
        isPublished: true,
        publishedAt: new Date(),
        sortOrder: i,
      };
      if (existing) {
        await prisma.clip.update({ where: { id: existing.id }, data });
      } else {
        await prisma.clip.create({ data: { ...data, themeId: row.id } });
      }
      clipCount += 1;
    }

    const published = await prisma.clip.count({
      where: { themeId: row.id, isPublished: true },
    });
    await prisma.libraryTheme.update({ where: { id: row.id }, data: { clipCount: published } });
    console.log(`  ${theme.emoji} ${row.name} — ${published} clips`);
  }

  console.log(`\nDone: ${themeCount} themes, ${clipCount} clips.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
