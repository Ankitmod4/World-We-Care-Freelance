/**
 * Seed the starting event categories.
 *
 * Choosing a category is REQUIRED to post an event, so this is not
 * optional decoration — with an empty table nobody can add anything
 * to the calendar at all.
 *
 * It does a second job too, and it is the reason these particular
 * names were chosen. An empty calendar showing "Sober socials ·
 * Meetups · Fundraisers · Workshops" tells a visitor what this place
 * does and what they could start. An empty calendar showing nothing
 * tells them to leave. The categories are the prompt.
 *
 * Run it once after `prisma db push`, then manage the list from
 * /admin/events/categories.
 *
 * Idempotent: upserted by slug with an EMPTY `update`, so re-running
 * fills in anything missing and never overwrites a name, colour or
 * sort order an admin has since changed.
 *
 * Run:
 *   npm run db:seed-event-categories
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

const CATEGORIES = [
  {
    name: "Sober socials",
    emoji: "☕",
    color: "#0ea5e9",
    description: "Coffee, board games, a film — company without a bar.",
  },
  {
    name: "Meetups",
    emoji: "👋",
    color: "#10b981",
    description: "Regular groups, newcomer nights, and open meetings.",
  },
  {
    name: "Movement",
    emoji: "🏃",
    color: "#f59e0b",
    description: "Walks, runs, swims, classes — all paces welcome.",
  },
  {
    name: "Fundraisers",
    emoji: "💛",
    color: "#ec4899",
    description: "Raising money and awareness for the work.",
  },
  {
    name: "Workshops",
    emoji: "🛠️",
    color: "#6366f1",
    description: "Learning something practical together.",
  },
  {
    name: "Volunteering",
    emoji: "🤝",
    color: "#14b8a6",
    description: "Litter picks, food banks, lending a hand locally.",
  },
  {
    name: "Family friendly",
    emoji: "🧒",
    color: "#84cc16",
    description: "Things you can bring the kids to.",
  },
  {
    name: "Online",
    emoji: "💻",
    color: "#64748b",
    description: "Anywhere with a signal — no travel needed.",
  },
];

async function main() {
  console.log("Seeding live categories…");
  let created = 0;
  let kept = 0;

  for (const [i, c] of CATEGORIES.entries()) {
    const slug = slugify(c.name);
    const before = await prisma.eventCategory.findUnique({
      where: { slug },
      select: { id: true },
    });
    await prisma.eventCategory.upsert({
      where: { slug },
      create: {
        name: c.name,
        slug,
        description: c.description,
        emoji: c.emoji,
        color: c.color,
        sortOrder: i,
        isActive: true,
      },
      update: {},
    });
    if (before) {
      kept += 1;
    } else {
      created += 1;
      console.log(`  ✓ ${c.emoji}  ${c.name}`);
    }
  }

  const active = await prisma.eventCategory.count({ where: { isActive: true } });
  console.log(`\n  ${created} created, ${kept} already present.`);
  console.log(`  ${active} active — members can now post an event.`);

  // Events that predate categories keep a null categoryId. Past ones
  // are history and nobody browses them by category, but UPCOMING ones
  // are invisible to the chips until an admin files them, so the count
  // is split — a number you can act on rather than one you can't.
  const [uncategorised, upcomingUncategorised] = await Promise.all([
    prisma.event.count({ where: { categoryId: null } }),
    prisma.event.count({
      where: { categoryId: null, status: "APPROVED", startsAt: { gte: new Date() } },
    }),
  ]);
  if (uncategorised > 0) {
    console.log(`  ${uncategorised} existing event(s) have no category.`);
  }
  if (upcomingUncategorised > 0) {
    console.log(
      `  ${upcomingUncategorised} of them are STILL UPCOMING and won't appear under any chip — ` +
        `set a category on those at /admin/events.`,
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
