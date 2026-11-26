/**
 * Repair cached counters across the whole database.
 *
 *   npm run counters:check    # report only, changes nothing
 *   npm run counters:fix      # writes the corrections
 *
 * WHY YOU NEED THIS ONCE. `deleteAccount` used to delete a departing
 * member's likes, saves, hearts, supports, RSVPs and chat memberships
 * without recounting the posts, clips, rooms and campaigns they hung
 * off. Every deletion left those counters permanently too high and
 * nothing corrected them, so the drift compounded. The code no longer
 * does that (see the recount at the end of `deleteAccount`), but the
 * drift already banked in the database has to be swept out by hand —
 * that is this.
 *
 * It is also safe to run any time. Nothing here invents a number: it
 * recomputes every counter from the rows that define it, using the
 * same definitions the app's own write paths use, and touches only the
 * rows where the stored value and the real one disagree.
 *
 * Dry run by default. The same convention as media:sweep — you should
 * be able to see what a script wants to do before it does it.
 */

import { PrismaClient } from "@prisma/client";
import { recountCounters, type CounterFix } from "../src/lib/recount";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

function summarise(fixes: CounterFix[]): void {
  if (fixes.length === 0) {
    console.log("\nEvery counter already matches. Nothing to do.");
    return;
  }

  const byCounter = new Map<string, CounterFix[]>();
  for (const f of fixes) {
    byCounter.set(f.counter, [...(byCounter.get(f.counter) ?? []), f]);
  }

  console.log(`\n${apply ? "Corrected" : "Would correct"} ${fixes.length} value(s):\n`);
  for (const [counter, list] of [...byCounter].sort()) {
    const drift = list.reduce((n, f) => n + (f.from - f.to), 0);
    console.log(`  ${counter.padEnd(28)} ${String(list.length).padStart(5)} row(s)   net drift ${drift > 0 ? "+" : ""}${drift}`);
    // A handful of examples, so the numbers are checkable by hand
    // against the database rather than taken on trust.
    for (const f of list.slice(0, 3)) {
      console.log(`      ${f.id}  ${f.from} → ${f.to}`);
    }
    if (list.length > 3) console.log(`      … and ${list.length - 3} more`);
  }
}

async function main(): Promise<void> {
  console.log(apply ? "Recounting and WRITING corrections." : "Recounting (dry run — nothing will be written).");

  const fixes = await recountCounters({
    scopeIds: null,
    dryRun: !apply,
    onProgress: (counter, checked, fixed) => {
      const flag = fixed === 0 ? "ok " : "FIX";
      console.log(`  ${flag} ${counter.padEnd(28)} ${String(checked).padStart(7)} checked  ${String(fixed).padStart(6)} off`);
    },
  });

  summarise(fixes);

  if (!apply && fixes.length > 0) {
    console.log("\nRe-run with --apply to write these.");
  }
}

main()
  .catch((err) => {
    console.error("\nFailed:", err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
