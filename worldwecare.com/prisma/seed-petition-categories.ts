/**
 * Seed the starting petition categories.
 *
 * Choosing one is REQUIRED to start a petition, so this is not
 * optional decoration — with an empty table nobody can start anything
 * at all, and `submitPetition` will refuse every submission with
 * "Choose what this petition is about."
 *
 * It does a second job too, and it is the reason these particular
 * names were chosen. An empty petitions page showing "Housing ·
 * Health services · Transport · Policing" tells a visitor what kind of
 * thing you can ask for here and what they could start. An empty page
 * showing nothing tells them to leave. The categories are the prompt.
 *
 * WHY NOT THE EVENT LIST. A petition is aimed at a body that can say
 * yes, so these are the areas such bodies have departments for.
 * "Sober socials" is a thing you attend; it is not a thing you can
 * petition a council about.
 *
 * Run it once after `prisma db push`:
 *   npm run db:seed-petition-categories
 *
 * Idempotent: upserted by slug with an EMPTY `update`, so re-running
 * fills in anything missing and never overwrites a name, colour or
 * sort order somebody has since changed.
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
    name: "Health services",
    emoji: "🏥",
    color: "#0ea5e9",
    description: "Clinics, waiting lists, treatment and detox beds.",
  },
  {
    name: "Addiction & recovery",
    emoji: "🌱",
    color: "#10b981",
    description: "Needle exchanges, recovery meetings, rehab funding.",
  },
  {
    name: "Mental health",
    emoji: "🧠",
    color: "#8b5cf6",
    description: "Crisis lines, counselling, support in schools.",
  },
  {
    name: "Housing",
    emoji: "🏠",
    color: "#f59e0b",
    description: "Shelters, evictions, damp, and somewhere to live.",
  },
  {
    name: "Food & poverty",
    emoji: "🥫",
    color: "#ec4899",
    description: "Food banks, free school meals, benefits that arrive.",
  },
  {
    name: "Transport",
    emoji: "🚌",
    color: "#14b8a6",
    description: "Bus routes, fares, and getting to where help is.",
  },
  {
    name: "Policing & justice",
    emoji: "⚖️",
    color: "#64748b",
    description: "How the law is applied, and to whom.",
  },
  {
    name: "Schools & young people",
    emoji: "🎒",
    color: "#84cc16",
    description: "What children are taught, and what they are offered.",
  },
  {
    name: "Access & disability",
    emoji: "♿",
    color: "#6366f1",
    description: "Step-free routes, adaptations, being able to get in.",
  },
  {
    name: "Local services",
    emoji: "🏛️",
    color: "#a16207",
    description: "Libraries, shelters, community centres — the things a council runs.",
  },
  {
    name: "Environment",
    emoji: "🌳",
    color: "#22c55e",
    description: "Air, water, green space, and what gets built on it.",
  },
  {
    name: "Something else",
    emoji: "📣",
    color: "#0891b2",
    description: "Anything that doesn't fit the rest.",
  },
];

async function main() {
  console.log("Seeding petition categories…");
  let created = 0;
  let kept = 0;

  for (const [i, c] of CATEGORIES.entries()) {
    const slug = slugify(c.name);
    const before = await prisma.petitionCategory.findUnique({
      where: { slug },
      select: { id: true },
    });
    await prisma.petitionCategory.upsert({
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

  const active = await prisma.petitionCategory.count({ where: { isActive: true } });
  console.log(`\n  ${created} created, ${kept} already present.`);
  console.log(`  ${active} active — members can now start a petition.`);

  // Petitions that predate categories keep a null categoryId. A closed
  // one is history and nobody browses those by category, but an OPEN
  // one is invisible to every tile until somebody files it — so the
  // number is split into one you can act on and one you can't.
  const now = new Date();
  const [uncategorised, openUncategorised] = await Promise.all([
    prisma.petition.count({ where: { categoryId: null } }),
    prisma.petition.count({
      where: {
        categoryId: null,
        status: "APPROVED",
        OR: [{ closesAt: null }, { closesAt: { gt: now } }],
      },
    }),
  ]);
  if (uncategorised > 0) {
    console.log(`  ${uncategorised} existing petition(s) have no category.`);
  }
  if (openUncategorised > 0) {
    console.log(
      `  ${openUncategorised} of them are STILL OPEN and won't appear under any tile — ` +
        `re-run \`npm run db:seed-petitions\` to file the seeded ones, or set a category at /admin/petitions.`,
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
