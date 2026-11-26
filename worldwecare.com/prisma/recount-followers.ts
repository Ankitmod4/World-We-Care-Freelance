/**
 * Rebuild User.followerCount from the UserFollow rows.
 *
 *   npm run follows:recount
 *
 * Run it once after adding the column (every existing user is sitting
 * at the default 0), and any time the counter looks wrong. It is
 * idempotent and safe on a live database: it only writes rows whose
 * stored count disagrees with the real one, and it reports what it
 * changed rather than doing it quietly.
 *
 * Same self-healing convention as the other denormalised counters in
 * this codebase — the count of record is always the rows, and the
 * column is a cache of them.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry");

  const [users, grouped] = await Promise.all([
    prisma.user.findMany({ select: { id: true, displayName: true, followerCount: true } }),
    prisma.userFollow.groupBy({ by: ["followingId"], _count: { _all: true } }),
  ]);

  const real = new Map(grouped.map((g) => [g.followingId, g._count._all]));

  let fixed = 0;
  for (const u of users) {
    const should = real.get(u.id) ?? 0;
    if (should === u.followerCount) continue;
    console.log(
      `  ${dryRun ? "would fix" : "fixed"}  ${u.displayName}: ${u.followerCount} → ${should}`,
    );
    if (!dryRun) {
      await prisma.user.update({ where: { id: u.id }, data: { followerCount: should } });
    }
    fixed++;
  }

  console.log(
    `\n${users.length} members checked, ${fixed} ${dryRun ? "would be corrected" : "corrected"}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
