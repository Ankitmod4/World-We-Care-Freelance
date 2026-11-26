/**
 * What a member would actually see, per language.
 *
 *   npm run i18n:status
 *
 * WHY THIS EXISTS. "I picked a language and nothing happened" has one
 * boring cause and one alarming one, and from the outside they look
 * identical: either that language has no translations yet — in which
 * case every string correctly falls back to English and the page is
 * unchanged — or something is broken. This tells you which, in one
 * command, without opening the database.
 *
 * Read-only. Nothing here writes.
 */

import { prisma } from "../src/lib/db";
import { listLocalesWithProgress, translationKeyStatus } from "../src/lib/translations-admin";
import { DEFAULT_LOCALE } from "../src/lib/i18n-core";

function bar(pct: number): string {
  const n = Math.round(pct / 5);
  return "[" + "#".repeat(n) + ".".repeat(20 - n) + "]";
}

async function main() {
  const key = await translationKeyStatus();
  console.log(
    `Google key:  ${key.configured ? `set (${key.hint}, from the ${key.source})` : "NOT SET"}`,
  );

  const { locales, totalStrings } = await listLocalesWithProgress();
  console.log(`Catalogue:   ${totalStrings} strings`);
  if (totalStrings === 0) {
    console.log("\n  The catalogue is EMPTY, so there is nothing to translate into");
    console.log("  anything. Run:  npm run i18n:extract -- --apply");
  }

  const live = locales.filter((l) => l.isEnabled);
  console.log(
    `\nIn the member's picker: English${live.length ? ", " + live.map((l) => l.name).join(", ") : " only"}`,
  );
  if (!live.length) {
    console.log("  No language is switched on, so the picker is hidden entirely.");
  }

  console.log("\nlanguage            live  translated            reviewed  stale");
  console.log("─".repeat(72));
  for (const l of locales) {
    if (!l.isEnabled && l.translated === 0) continue; // untouched: noise
    const pct = totalStrings ? (l.translated / totalStrings) * 100 : 0;
    console.log(
      l.name.padEnd(20).slice(0, 20) +
        (l.isEnabled ? " yes " : "  no ") +
        ` ${bar(pct)} ${String(l.translated).padStart(5)}/${totalStrings}` +
        ` ${String(l.reviewed).padStart(8)} ${String(l.stale).padStart(6)}`,
    );
  }

  // The actual answer to the actual question.
  console.log("");
  for (const l of live) {
    if (l.code === DEFAULT_LOCALE) continue;
    if (l.translated === 0) {
      console.log(
        `${l.name} is switched ON but has NOTHING translated, so a member who picks`,
      );
      console.log(
        `  it sees the site in English. That is the fallback working, not a bug.`,
      );
      console.log(
        `  Fix: open /admin/translations, choose ${l.name}, press "Fill gaps".`,
      );
    } else if (l.translated < totalStrings) {
      const missing = totalStrings - l.translated;
      console.log(
        `${l.name}: ${missing} of ${totalStrings} strings are still English. Press "Fill gaps" again.`,
      );
    } else {
      console.log(`${l.name}: fully translated.`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
