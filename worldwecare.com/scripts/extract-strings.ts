/**
 * Put every translatable string in the source into the catalogue.
 *
 *   npm run i18n:extract          # report only
 *   npm run i18n:extract -- --apply
 *   npm run i18n:extract -- --apply --prune
 *
 * ── THE WORK IS IN `src/lib/i18n-extract.ts`, NOT HERE ──
 *
 * This file is a terminal for it. The same function runs behind the
 * "Update from the code" button on the Translations page, because the
 * person who keeps the translations current is not the person with a
 * shell on the server — and a maintenance step that needs a terminal
 * is a maintenance step that stops happening.
 *
 * Keeping the script is deliberate rather than nostalgic: it is the
 * right thing in a deploy script, it works on a standalone build
 * where the admin button cannot, and it is how you see the full list
 * of what changed rather than a count.
 *
 * DRY BY DEFAULT. Running this without `--apply` writes nothing and
 * prints exactly what it would do, because the first thing anyone
 * does with a script like this is run it to see what it thinks.
 *
 * `--prune` IS SEPARATE AND DELIBERATE. A key that has left the code
 * still has translations attached, and those translations may have
 * been typed by a person. Deleting them because a component was
 * renamed mid-refactor would be losing work to a temporary state of
 * the tree, so removals are reported by default and only deleted when
 * asked for specifically.
 */

import { prisma } from "../src/lib/db";
import { extractStrings } from "../src/lib/i18n-extract";

async function main() {
  const apply = process.argv.includes("--apply");
  const prune = process.argv.includes("--prune");
  const ignoreUnreadable = process.argv.includes("--ignore-unreadable");

  const r = await extractStrings({ apply, prune, ignoreUnreadable });

  if (!r.sourceAvailable) {
    console.log(r.refused);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Scanned ${r.scannedFiles} files, found ${r.calls} calls / ${r.strings} strings.`,
  );
  console.log(`Read ${r.serverFiles} server files for thrown messages.`);
  console.log(`Catalogue is ${r.characters.toLocaleString()} characters of English.`);

  if (r.collisions.length) {
    console.log(`\nSAME KEY, DIFFERENT ENGLISH (${r.collisions.length}) — fix these first:`);
    for (const c of r.collisions) {
      console.log(`  ${c.key}`);
      for (const v of c.variants) {
        console.log(`    ${v.file}:${v.line}  ${JSON.stringify(v.english)}`);
      }
    }
  }

  if (r.problems.length) {
    console.log(
      `\nCOULD NOT READ (${r.problems.length}) — these strings can never be translated:`,
    );
    for (const p of r.problems) {
      console.log(`  ${p.file}:${p.line}  ${p.reason}\n    ${p.excerpt}`);
    }
  }

  console.log(`\n  new:      ${r.added.length}`);
  console.log(`  changed:  ${r.changed.length}   (their translations become stale)`);
  console.log(
    `  removed:  ${r.removed.length}${r.removed.length && !prune ? "   (kept — pass --prune to delete)" : ""}`,
  );
  for (const k of r.changed.slice(0, 20)) console.log(`    changed: ${k}`);
  for (const k of r.removed.slice(0, 20)) console.log(`    removed: ${k}`);

  if (r.refused) {
    console.log(`\n${r.refused}`);
    process.exitCode = 1;
    return;
  }

  if (!apply) {
    console.log("\nDry run. Pass --apply to write.");
    return;
  }

  console.log(`\nWrote ${r.wrote} strings.`);
  if (r.pruned) console.log(`Pruned ${r.pruned} strings no longer in the source.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
