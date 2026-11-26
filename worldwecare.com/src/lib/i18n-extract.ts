/**
 * Reading the code and putting what it says into the catalogue.
 *
 * ── WHY THIS IS A LIBRARY AND NOT A SCRIPT ──
 *
 * It started as one, run as `npm run i18n:extract -- --apply`, which
 * is fine for whoever deploys the site and useless for whoever runs
 * it. The person who actually keeps the translations up to date opens
 * an admin page; asking them to open a terminal on the server every
 * time a sentence changes means it does not get done, and the site
 * quietly drifts back to English one new string at a time.
 *
 * So the work lives here and has two callers: the CLI, which still
 * works and is still the right thing in a deploy script, and a button
 * on the Translations page.
 *
 * ── IT READS THE SOURCE AT RUNTIME ──
 *
 * Which means `src/` has to be on the server. It is for a deployment
 * that uploads the repo and runs `next build` there, and it is NOT
 * for a standalone or containerised build that ships only `.next`.
 * Rather than fail with a stack trace about a missing directory, an
 * empty scan is reported as exactly what it is — see `sourceAvailable`
 * — so the button can say "this server does not have the code" and
 * the CLI stays the answer for those deployments.
 *
 * ── NOTHING IS WRITTEN UNLESS ASKED ──
 *
 * `apply` defaults to false and `prune` is separate, because the two
 * side effects are very different sizes. Writing adds rows and marks
 * changed English as stale. Pruning DELETES strings and cascades to
 * translations somebody may have typed by hand.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { prisma } from "./db";
import {
  dedupe,
  findCollisions,
  scanServerMessages,
  scanSource,
  type FoundString,
  type ScanProblem,
} from "./string-scan";
import { upsertString } from "./translations-admin";
import { hashSource } from "./i18n-core";

/**
 * The admin is not translated.
 *
 * It is used by a handful of people who chose to run this site, in
 * one language, and every string in it is a word like "Unpublish"
 * that would cost the same translation budget as a word a thousand
 * members read. If that changes it changes by deleting a line here.
 */
const SKIP = [
  path.join("src", "app", "admin"),
  path.join("src", "app", "api"),
  path.join("src", "components", "admin"),
];

/**
 * Where refusals are thrown.
 *
 * `src/app/api` is skipped above because a route has no `t()` calls
 * worth collecting — but it is exactly where `{ error: "Sign in to
 * watch." }` is written, so the SECOND pass walks it deliberately.
 * `src/lib` is walked by both: the first pass finds its `t()` calls
 * (the shared reason lists, the time ladder), the second its throws.
 */
const SERVER_ROOTS = [path.join("src", "lib"), path.join("src", "app", "api")];

export interface ExtractReport {
  /** False when `src/` is not on this server — see the docblock. */
  sourceAvailable: boolean;
  scannedFiles: number;
  serverFiles: number;
  /** Every call site found, before de-duplication. */
  calls: number;
  /** Distinct keys. */
  strings: number;
  characters: number;
  /** Keys not in the catalogue yet. */
  added: string[];
  /** Keys whose English moved — their translations become stale. */
  changed: string[];
  /** Keys in the catalogue that the code no longer uses. */
  removed: string[];
  /** Two call sites claiming one key with different English. */
  collisions: Array<{ key: string; variants: Array<{ file: string; line: number; english: string }> }>;
  /** Call sites the scanner could not read — see below. */
  problems: ScanProblem[];
  /** What actually happened. Zero on a dry run. */
  wrote: number;
  pruned: number;
  /**
   * Set when nothing was written and something should have been. The
   * caller shows this rather than inventing its own wording.
   */
  refused: string | null;
}

function* walk(dir: string, skip: string[]): Generator<string> {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    const full = path.join(dir, name);
    const rel = path.relative(process.cwd(), full);
    if (skip.some((s) => rel === s || rel.startsWith(s + path.sep))) continue;
    if (rel.includes(path.join("src", "_to_delete"))) continue;
    let isDir: boolean;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) yield* walk(full, skip);
    else if (/\.(tsx|ts)$/.test(name) && !/\.d\.ts$/.test(name)) yield full;
  }
}

export async function extractStrings(
  opts: { apply?: boolean; prune?: boolean; ignoreUnreadable?: boolean } = {},
): Promise<ExtractReport> {
  const apply = opts.apply === true;
  const prune = opts.prune === true;
  const root = path.join(process.cwd(), "src");

  const report: ExtractReport = {
    sourceAvailable: true,
    scannedFiles: 0,
    serverFiles: 0,
    calls: 0,
    strings: 0,
    characters: 0,
    added: [],
    changed: [],
    removed: [],
    collisions: [],
    problems: [],
    wrote: 0,
    pruned: 0,
    refused: null,
  };

  let rootExists = false;
  try {
    rootExists = statSync(root).isDirectory();
  } catch {
    rootExists = false;
  }
  if (!rootExists) {
    report.sourceAvailable = false;
    report.refused =
      "The application's source code is not on this server, so there is nothing to " +
      "read. This happens with a standalone or container build that ships only the " +
      "compiled site. Run `npm run i18n:extract -- --apply` wherever the code lives.";
    return report;
  }

  // ── pass one: t() call sites ────────────────────────────────
  const found: FoundString[] = [];
  for (const file of walk(root, SKIP)) {
    const rel = path.relative(process.cwd(), file);
    const src = readFileSync(file, "utf8");
    if (!src.includes("t(")) continue;
    report.scannedFiles += 1;
    const res = scanSource(rel, src);
    found.push(...res.found);
    report.problems.push(...res.problems);
  }

  // ── pass two: sentences the server throws ───────────────────
  for (const rootRel of SERVER_ROOTS) {
    const full = path.join(process.cwd(), rootRel);
    for (const file of walk(full, [path.join("src", "app", "api", "admin")])) {
      const rel = path.relative(process.cwd(), file);
      report.serverFiles += 1;
      found.push(...scanServerMessages(rel, readFileSync(file, "utf8")));
    }
  }

  // A scan that reads no files at all is a broken scan, not an empty
  // catalogue — and writing on it would prune everything.
  if (report.scannedFiles === 0) {
    report.sourceAvailable = false;
    report.refused =
      "Found the src folder but no readable source files in it. Nothing has been changed.";
    return report;
  }

  const collisions = findCollisions(found);
  const entries = dedupe(found);
  report.calls = found.length;
  report.strings = entries.length;
  report.characters = entries.reduce((n, e) => n + e.english.length, 0);
  report.collisions = collisions.map((c) => ({ key: c.key, variants: c.variants }));

  // ── what would change ───────────────────────────────────────
  const existing = await prisma.translationString.findMany({
    select: { key: true, english: true, sourceHash: true },
  });
  const byKey = new Map(existing.map((e) => [e.key, e]));
  const liveKeys = new Set(entries.map((e) => e.key));

  for (const e of entries) {
    const prev = byKey.get(e.key);
    if (!prev) {
      report.added.push(e.key);
      continue;
    }
    if ((await hashSource(e.english)) !== prev.sourceHash) report.changed.push(e.key);
  }
  report.removed = existing.filter((e) => !liveKeys.has(e.key)).map((e) => e.key);

  /*
     TWO REASONS TO REFUSE, both of which mean the catalogue would be
     quietly wrong rather than loudly broken.

     A COLLISION is two call sites claiming one key with different
     English — whichever is written last wins, and the other screen
     silently shows the wrong sentence.

     AN UNREADABLE CALL SITE is a string that can never be translated:
     `t(`time.${unit}`, …)` compiles, runs, and is invisible here, so
     the key never reaches the catalogue and `t()` falls through to
     English forever. That is how a fully translated page shipped
     stamped "4w ago".
  */
  if (collisions.length) {
    report.refused =
      "Two places in the code use the same key for different English. " +
      "Nothing has been written — fix those first.";
    return report;
  }
  if (report.problems.length && !opts.ignoreUnreadable) {
    report.refused =
      `${report.problems.length} place${report.problems.length === 1 ? "" : "s"} in the code ` +
      "build a translation key instead of writing it out, which means those strings can " +
      "never be translated. Nothing has been written.";
    return report;
  }

  if (!apply) return report;

  for (const e of entries) await upsertString(e);
  report.wrote = entries.length;

  if (prune && report.removed.length) {
    const res = await prisma.translationString.deleteMany({
      where: { key: { in: report.removed } },
    });
    report.pruned = res.count;
  }

  return report;
}
