/**
 * Starter categories for the gratitude wall.
 *
 * These are a starting point, not a taxonomy — an admin will rename
 * and reorder them once real posts arrive and show what people
 * actually write about. They exist so the feature is visible on day
 * one rather than being an empty dropdown nobody notices.
 *
 * The wording is chosen carefully: a category list is the first thing
 * someone reads before deciding whether it is safe to be honest here.
 *
 * Idempotent — upserted by slug.
 *
 *   npm run db:seed-post-categories
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface Seed {
  name: string;
  slug: string;
  emoji: string;
  description: string;
}

const GRATITUDE: Seed[] = [
  { name: "Small wins", slug: "small-wins", emoji: "✨", description: "The day you got through, the call you made." },
  { name: "People who helped", slug: "people-who-helped", emoji: "🤝", description: "Someone who showed up." },
  { name: "Milestones", slug: "milestones", emoji: "🏁", description: "A week, a month, a year." },
  { name: "Family", slug: "family-gratitude", emoji: "🏠", description: "The people at home." },
  { name: "Health", slug: "health", emoji: "🫀", description: "Sleeping again, eating again, walking again." },
  { name: "This community", slug: "this-community", emoji: "💚", description: "Something you read here that helped." },
  { name: "Everyday things", slug: "everyday-things", emoji: "☕", description: "Coffee, the bus arriving, a quiet morning." },
];

async function main() {
  console.log("Seeding gratitude categories…\n");

  let n = 0;
  for (const [i, c] of GRATITUDE.entries()) {
    await prisma.gratitudeCategory.upsert({
      where: { slug: c.slug },
      create: { ...c, sortOrder: i * 10 },
      update: { name: c.name, emoji: c.emoji, description: c.description, sortOrder: i * 10 },
    });
    n += 1;
    console.log(`  gratitude   ${c.emoji} ${c.name}`);
  }

  console.log(`\nDone: ${n} categories. Existing posts keep whatever they had.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
