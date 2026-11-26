/**
 * A quick count of what's actually in the database.
 *
 *   npx tsx prisma/whats-in-the-db.ts
 *
 * Written for one question: did a `--force-reset` wipe this? Zero
 * users with a schema that pushed cleanly is the signature of it.
 * Read-only — it counts and prints, nothing else.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [users, admins, heroes, cats, posts] = await Promise.all([
    prisma.user.count(),
    prisma.adminUser.count(),
    prisma.townHero.count().catch(() => -1),
    prisma.townHeroCategory.count().catch(() => -1),
    prisma.post.count().catch(() => -1),
  ]);

  console.log(`  members ............ ${users}`);
  console.log(`  admins ............. ${admins}`);
  console.log(`  posts .............. ${posts === -1 ? "table missing" : posts}`);
  console.log(`  town heroes ........ ${heroes === -1 ? "table missing" : heroes}`);
  console.log(`  hero categories .... ${cats === -1 ? "table missing" : cats}`);

  if (users === 0 && admins === 0) {
    console.log(
      "\nEverything is empty — this database was reset. That is why login returns 401:\n" +
        "there is no account with that email any more.",
    );
  } else if (users === 0) {
    console.log("\nNo members, but admins survive — a member login will 401, an admin login won't.");
  } else {
    console.log("\nAccounts are intact, so the 401 is a credentials or cookie problem, not a wipe.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
