/**
 * Give every hero a category, so `categoryId` can become required.
 *
 *   npm run heroes:check     show what would change
 *   npm run heroes:fix       do it
 *   npx prisma db push       now succeeds
 *
 * WHY THIS EXISTS. `TownHero.categoryId` changed from optional to
 * required. MySQL will not add a NOT NULL column to a table that
 * already has rows with no value for it, and the error it gives —
 * "there are 3 existing NULL values" — tells you nothing about which
 * three or what to do with them.
 *
 * IT BACKFILLS, IT DOES NOT DELETE. An earlier version of this script
 * deleted the sample rows, because at that point the categories table
 * did not exist yet and assigning one was impossible. It does now, so
 * the right answer is to file them: nobody has to lose a nomination to
 * a schema change, and this works the same for a real member's
 * nomination as for a seeded sample.
 *
 * The three seeded samples go where the seed always meant them to go.
 * Anything else — a real nomination made while the column was still
 * optional — goes to "Anything else", which is the catch-all the seed
 * creates, and an admin can re-file it in a click afterwards.
 *
 * Safe to run twice: rows that already have a category are untouched.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

/** Where the seeded samples were always meant to sit. */
const KNOWN: Record<string, string> = {
  "sample-marie-o-donnell": "food-and-meals",
  "sample-danny-whelan": "animals",
  "sample-aisha-rahman": "young-people",
  "sample-eileen-brady": "checking-in",
};

const FALLBACK = "anything-else";

async function main() {
  // Raw throughout: the generated client may already have been built
  // against the required schema, in which case `categoryId: null` is
  // not a query it will let us write.
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; slug: string; heroName: string }>>(
    "SELECT id, slug, heroName FROM town_heroes WHERE categoryId IS NULL",
  );

  if (rows.length === 0) {
    console.log("Every hero already has a category. `npx prisma db push` will go through.");
    return;
  }

  const cats = await prisma.$queryRawUnsafe<Array<{ id: string; slug: string; name: string }>>(
    "SELECT id, slug, name FROM town_hero_categories",
  );
  if (cats.length === 0) {
    console.log(
      "No categories exist yet — run `npm run db:seed-town-hero-categories` first, then this.",
    );
    process.exitCode = 1;
    return;
  }

  const bySlug = new Map(cats.map((c) => [c.slug, c]));
  const fallback = bySlug.get(FALLBACK) ?? cats[cats.length - 1];

  const plan = rows.map((r) => {
    const target = bySlug.get(KNOWN[r.slug] ?? "") ?? fallback;
    return { ...r, target };
  });

  console.log(`${plan.length} hero${plan.length === 1 ? "" : "es"} with no category:\n`);
  for (const p of plan) {
    const guessed = KNOWN[p.slug] ? "" : "  (no better guess)";
    console.log(`  ${p.heroName}  →  ${p.target.name}${guessed}`);
  }

  if (!apply) {
    console.log("\nRun `npm run heroes:fix` to apply this, then `npx prisma db push`.");
    return;
  }

  for (const p of plan) {
    await prisma.$executeRawUnsafe(
      "UPDATE town_heroes SET categoryId = ? WHERE id = ?",
      p.target.id,
      p.id,
    );
  }

  console.log(`\nFiled ${plan.length}. \`npx prisma db push\` will now go through.`);
  const guessedCount = plan.filter((p) => !KNOWN[p.slug]).length;
  if (guessedCount > 0) {
    console.log(
      `${guessedCount} went to "${fallback.name}" because there was no better guess —` +
        " re-file them in Admin → Town Heroes.",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
