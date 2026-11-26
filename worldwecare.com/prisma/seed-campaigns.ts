/**
 * Seed four awareness campaigns.
 *
 * A campaign owns no content, so this seed CREATES NOTHING except the
 * campaigns themselves — it finds articles, events and chatrooms that
 * are already in the database and points at them. Run the article,
 * event and chat seeds first and these pages fill up; run it on an
 * empty database and you get four valid campaigns with empty sections,
 * which is also a state worth being able to look at.
 *
 * Matching is by keyword against titles and category names rather than
 * by hard-coded ids, so it survives the other seeds being re-run.
 *
 * Idempotent: campaigns are upserted by slug and attachments are
 * upserted by their composite key.
 *
 * EVERY CAMPAIGN HERE IS FILED UNDER A CATEGORY, by slug rather than
 * by id so it survives the category seed being re-run. The categories
 * are what the section is browsed by, and a seeded campaign with no
 * category is one that exists on the index and under no tile — which
 * is exactly the state the tiles were added to get rid of. So:
 *
 *   npm run db:seed-campaign-categories   # FIRST, and required
 *   npm run db:seed-campaigns
 *
 * Run the other way round and this refuses rather than seeding
 * uncategorised campaigns you would then have to find and fix by hand.
 *
 * Run:
 *   npm run db:seed-campaigns
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

const days = (n: number) => new Date(Date.now() + n * 86_400_000);

interface SeedCampaign {
  title: string;
  emoji: string;
  /**
   * A CampaignCategory slug, from prisma/seed-campaign-categories.ts.
   * Required, exactly as it is for a real submission — there is no
   * such thing here either as a campaign nobody can find.
   */
  category: string;
  summary: string;
  body: string;
  callToAction?: string;
  ctaUrl?: string;
  startsAt?: Date;
  endsAt?: Date;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  /** Words to look for in article titles or their category names. */
  articleTerms: string[];
  /** Words to look for in event titles. */
  eventTerms: string[];
  /** Words to look for in a chatroom name. */
  roomTerms: string[];
}

const CAMPAIGNS: SeedCampaign[] = [
  {
    title: "Nobody Drinks Alone This December",
    category: "addiction-and-recovery",
    emoji: "🫂",
    summary:
      "December is the hardest month to stay sober. We're making sure there's somewhere to go on every one of its evenings.",
    body: [
      "## Why December",
      "",
      "Every service that works with people in recovery says the same thing: the weeks between the first office party and the second of January are the ones that undo a year of work. Not because anyone's resolve weakens, but because **everything closes** — groups pause, counsellors take leave, and the invitations that arrive all happen in pubs.",
      "",
      "> \"I wasn't tempted. I was just on my own with it, every night, for three weeks.\"",
      "",
      "### What we're doing",
      "",
      "- A sober social every single evening in December, somewhere in the network",
      "- The recovery room staffed later, until midnight, right through the month",
      "- A simple list anyone can share with someone who needs it",
      "",
      "### What you can do",
      "",
      "Come to one. Bring one person. If you host anything at all — a walk, a games night, a coffee — put it on the calendar so it shows up on this page.",
    ].join("\n"),
    callToAction: "See what's on",
    ctaUrl: "/events",
    startsAt: days(-14),
    endsAt: days(45),
    articleTerms: ["sober", "recovery", "first week", "social"],
    eventTerms: ["sober", "coffee", "board games"],
    roomTerms: ["Sober", "Recovery"],
  },
  {
    title: "Ask Twice",
    category: "mental-health",
    emoji: "💬",
    summary:
      "\"I'm fine\" is the most-told lie in the language. A campaign about asking a second time, and knowing what to do with the answer.",
    body: [
      "## The first answer is rarely the true one",
      "",
      "Most people asked how they are will say they're fine. Most people who say they're fine and are not are waiting to be asked again — once, gently, by someone who has clearly got time for the real answer.",
      "",
      "That is the whole campaign. **Ask twice.**",
      "",
      "### And then what?",
      "",
      "The part that stops people asking at all is not knowing what to do if the answer is bad. You do not need to fix anything. You need to not flinch, not rush, and not immediately hand them a phone number.",
      "",
      "The reading below covers what to say, what not to say, and what actually helps.",
    ].join("\n"),
    callToAction: "Read: what to say",
    ctaUrl: "/articles",
    startsAt: days(-30),
    articleTerms: ["struggling", "ask for help", "low day", "burnout", "mental"],
    eventTerms: ["meditation"],
    roomTerms: ["Anxiety", "Mental Health"],
  },
  {
    title: "The Shelves Are Emptier Than the Headlines Say",
    category: "food-and-poverty",
    emoji: "🥫",
    summary:
      "Food banks are short of the things nobody thinks to donate. A month of restocking what's actually needed.",
    body: [
      "## The gap between what's given and what's needed",
      "",
      "Food banks are generous places, and they are drowning in pasta. What they run out of is everything else: tinned fish, cooking oil, nappies, period products, washing powder, and anything that can be eaten by someone with no working cooker.",
      "",
      "### This month",
      "",
      "1. Two restock evenings, sorting and shelving",
      "2. A shared list of what each local bank is actually short of, updated weekly",
      "3. A push on the items that never get donated",
      "",
      "If you can only do one thing: buy the thing on the list rather than the thing on offer.",
    ].join("\n"),
    callToAction: "Join a restock evening",
    ctaUrl: "/events",
    startsAt: days(-7),
    endsAt: days(30),
    articleTerms: ["food bank", "volunteer", "neighbourhood"],
    eventTerms: ["food bank", "litter"],
    roomTerms: ["Community", "Volunteering"],
  },
  {
    title: "Foster a Shelter Dog for a Fortnight",
    category: "something-else",
    emoji: "🐕",
    summary:
      "Shelters are full. Two weeks in a home is the difference between a dog that gets rehomed and one that doesn't.",
    body: [
      "## Two weeks, not forever",
      "",
      "The thing that puts people off fostering is imagining it as adoption with extra paperwork. It isn't. A fortnight is enough for a dog to stop kennel-stressing, start sleeping, and become an animal a family can meet without hearing it bark itself hoarse.",
      "",
      "### What's involved",
      "",
      "- Food, bedding and vet care are covered by the shelter",
      "- You give a warm room and two walks a day",
      "- If it goes wrong, they collect. Nobody is stuck.",
      "",
      "The walking sessions are a good place to start if you want to meet the dogs before deciding.",
    ].join("\n"),
    callToAction: "Come to a walking session",
    ctaUrl: "/events",
    startsAt: days(-3),
    articleTerms: ["fostering", "shelter", "animal"],
    eventTerms: ["dog walking", "shelter"],
    roomTerms: ["Animal", "Rescue"],
  },
];

/** Published articles whose title or category matches any of the terms. */
async function findArticles(terms: string[], take = 3) {
  const matches = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        ...terms.map((t) => ({ title: { contains: t } })),
        ...terms.map((t) => ({ category: { name: { contains: t } } })),
      ],
    },
    orderBy: { publishedAt: "desc" },
    take,
    select: { id: true, title: true },
  });
  return matches;
}

async function findEvents(terms: string[], take = 3) {
  return prisma.event.findMany({
    where: {
      status: "APPROVED",
      OR: terms.map((t) => ({ title: { contains: t } })),
    },
    orderBy: { startsAt: "asc" },
    take,
    select: { id: true, title: true },
  });
}

async function findRoom(terms: string[]) {
  for (const term of terms) {
    const room = await prisma.chatRoom.findFirst({
      where: { name: { contains: term } },
      select: { id: true, name: true },
    });
    if (room) return room;
  }
  return null;
}

/**
 * Category slug -> id, for every category this seed needs.
 *
 * Resolved ONCE and up front rather than per campaign, so a missing
 * category stops the run before anything is written instead of seeding
 * two campaigns and then failing on the third. Refusing here is the
 * whole point: the alternative is four campaigns filed nowhere, on the
 * index and under no tile, which somebody then has to notice.
 */
async function resolveCategories(): Promise<Map<string, string>> {
  const wanted = [...new Set(CAMPAIGNS.map((c) => c.category))];
  const rows = await prisma.campaignCategory.findMany({
    where: { slug: { in: wanted } },
    select: { id: true, slug: true },
  });
  const by = new Map(rows.map((r) => [r.slug, r.id]));

  const missing = wanted.filter((slug) => !by.has(slug));
  if (missing.length > 0) {
    console.error(
      `\nMissing campaign categor${missing.length === 1 ? "y" : "ies"}: ${missing.join(", ")}\n` +
        "Run `npm run db:seed-campaign-categories` first, then this again.\n",
    );
    process.exit(1);
  }
  return by;
}

async function main() {
  console.log("Seeding campaigns…\n");

  const categories = await resolveCategories();

  for (const seed of CAMPAIGNS) {
    const slug = slugify(seed.title);
    const [articles, events, room] = await Promise.all([
      findArticles(seed.articleTerms),
      findEvents(seed.eventTerms),
      findRoom(seed.roomTerms),
    ]);

    const data = {
      title: seed.title,
      emoji: seed.emoji,
      summary: seed.summary,
      body: seed.body,
      callToAction: seed.callToAction ?? null,
      ctaUrl: seed.ctaUrl ?? null,
      status: seed.status ?? ("PUBLISHED" as const),
      publishedAt: new Date(),
      startsAt: seed.startsAt ?? null,
      endsAt: seed.endsAt ?? null,
      chatRoomId: room?.id ?? null,
      // In `data`, so it is set on UPDATE as well as on create: a
      // campaign seeded before categories existed gets filed the next
      // time this runs, rather than staying invisible for ever.
      categoryId: categories.get(seed.category)!,
    };

    const campaign = await prisma.campaign.upsert({
      where: { slug },
      create: { ...data, slug },
      update: data,
      select: { id: true, title: true },
    });

    // Attachments are upserted by composite key, so re-running never
    // duplicates and never resets the order of what is already there.
    for (const [i, article] of articles.entries()) {
      await prisma.campaignArticle.upsert({
        where: { campaignId_articleId: { campaignId: campaign.id, articleId: article.id } },
        create: { campaignId: campaign.id, articleId: article.id, sortOrder: i },
        update: {},
      });
    }
    for (const [i, event] of events.entries()) {
      await prisma.campaignEvent.upsert({
        where: { campaignId_eventId: { campaignId: campaign.id, eventId: event.id } },
        create: { campaignId: campaign.id, eventId: event.id, sortOrder: i },
        update: {},
      });
    }

    const supporterCount = await prisma.campaignSupport.count({ where: { campaignId: campaign.id } });
    await prisma.campaign.update({ where: { id: campaign.id }, data: { supporterCount } });

    console.log(`  ${seed.emoji} ${campaign.title}`);
    console.log(`     /campaigns/${slug}  —  ${seed.category}`);
    console.log(
      `     ${articles.length} article(s), ${events.length} event(s), ` +
        `${room ? `room "${room.name}"` : "no room"}`,
    );
    if (articles.length === 0 && events.length === 0 && !room) {
      console.log("     ↳ nothing matched — run the article, event and chat seeds first");
    }
    console.log("");
  }

  console.log(`Done: ${CAMPAIGNS.length} campaigns.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
