/**
 * Does the media sweeper know about every table that stores an upload?
 *
 *   npm run media:refs
 *
 * WHY THIS EXISTS. `collectReferencedUrls` in src/lib/media.ts decides
 * which files are still in use; anything it does not name is an
 * "orphan", and `media:sweep --apply` deletes orphans. So a column
 * added without a matching line in that function is not a missing
 * feature — it is a delete queue for live member photos.
 *
 * That is not hypothetical. The function covered eight models while
 * the schema had seventeen, so the sweeper's report listed every
 * confession photo, every gratitude photo, every petition gallery,
 * every town hero portrait, every page banner and every direct-message
 * image as deletable.
 *
 * It compares two things it can actually see: the models in
 * schema.prisma that declare an upload-shaped column, and what
 * `collectReferencedUrls` SELECTS for each of them.
 *
 * IT USED TO CHECK ONLY THAT THE MODEL WAS READ, on the reasoning that
 * a whole missing table costs photos while a half-handled one is a
 * much smaller mistake. That reasoning was wrong, and it was caught
 * being wrong: `video` was added to Confession and GratitudeEntry, the
 * sweeper went on selecting `imageUrl` alone, and this script printed
 * `ok Confession imageUrl, video` — because the word "video" appeared
 * elsewhere in media.ts, for posts. A green light on a queue of
 * member videos waiting to be deleted.
 *
 * So it is per-column now, and per-model: the `select` block of each
 * `prisma.<model>.findMany` is parsed on its own, and a column named
 * in the schema but absent from THAT model's select is a failure. The
 * cost is that the parse is tied to the shape `collectReferencedUrls`
 * is written in — one `findMany` per model with a literal `select`. If
 * that ever changes, this script fails loudly rather than passing
 * quietly, which is the right way round.
 *
 * Exits non-zero when something is unaccounted for, so it can sit in
 * CI beside `typecheck`.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname ?? ".", "..");
const schema = readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");
const media = readFileSync(path.join(ROOT, "src/lib/media.ts"), "utf8");

/** Columns whose contents can be a path under /uploads/. */
const UPLOAD_COLUMN = /^\s*(coverUrl|imageUrl|photoUrl|avatarUrl|videoUrl|posterUrl|photos|video|images)\s/;

/** Models the sweeper is allowed not to read, with the reason. */
const EXEMPT: Record<string, string> = {
  // Snapshots of another row's image, never the original — deleting
  // the source is what frees the file.
  Notification: "holds a copy of another row's image url",
};

const models = new Map<string, string[]>();
let current: string | null = null;
for (const line of schema.split("\n")) {
  const m = /^model\s+(\w+)\s*\{/.exec(line);
  if (m) { current = m[1]; continue; }
  if (line.startsWith("}")) { current = null; continue; }
  if (!current) continue;
  const c = UPLOAD_COLUMN.exec(line);
  if (c) models.set(current, [...(models.get(current) ?? []), c[1]]);
}

/**
 * What the sweeper selects, per model.
 *
 * `prisma.gratitudeEntry.findMany({ select: { imageUrl: true, video: true } })`
 * becomes gratitudeentry -> {imageUrl, video}. The body is matched
 * non-greedily to the first `}`, which is all these selects are: one
 * flat level of `field: true`. A nested select would be mis-parsed, so
 * the shape check below refuses to let that pass silently.
 *
 * A model queried more than once has its selects UNIONED — the sweeper
 * is free to read a table twice, and what matters is the total set of
 * columns it ends up with.
 */
const selected = new Map<string, Set<string>>();
for (const [, model, body] of media.matchAll(
  /prisma\.(\w+)\.findMany\(\s*\{\s*(?:where:[^}]*\},\s*)?(?:orderBy:[^}]*\},\s*)?select:\s*\{([^}]*)\}/g,
)) {
  const key = model.toLowerCase();
  const cols = selected.get(key) ?? new Set<string>();
  for (const [, col] of body.matchAll(/(\w+)\s*:\s*true/g)) cols.add(col);
  selected.set(key, cols);
}

/*
 * THE GUARD ON THIS GUARD.
 *
 * Every check below is "is this column in that model's select?" — so if
 * the regex above matched nothing at all, every model would report as
 * missing and the failure would look like a catastrophe in media.ts
 * rather than a broken parse here. Worse, a regex that matched
 * everything loosely would report success for the same reason the old
 * version did.
 *
 * `post` is the assertion: it has been in `collectReferencedUrls` from
 * the beginning with a literal `select: { images: true, video: true,
 * body: true }`. If that is not what came out of the parse, this script
 * is not measuring what it claims to.
 */
const sanity = selected.get("post");
if (!sanity || !sanity.has("images") || !sanity.has("video")) {
  console.log(
    "This script could not parse the selects in src/lib/media.ts.\n" +
      `Expected prisma.post.findMany to select images and video; got ${
        sanity ? [...sanity].join(", ") : "no match at all"
      }.\n\n` +
      "That means collectReferencedUrls has been rewritten into a shape this\n" +
      "check cannot read — so it is no longer checking anything. Update the\n" +
      "parse above rather than deleting this message.",
  );
  process.exit(1);
}

const missing: Array<[string, string[], string]> = [];
for (const [model, cols] of models) {
  if (EXEMPT[model]) continue;
  // Prisma's client property is the model name, lower-camel.
  const prop = (model[0].toLowerCase() + model.slice(1)).toLowerCase();
  const got = selected.get(prop);
  if (!got) {
    missing.push([model, cols, "the sweeper never reads this table"]);
    continue;
  }
  const absent = cols.filter((c) => !got.has(c));
  if (absent.length) {
    missing.push([model, absent, `read, but without ${absent.join(", ")}`]);
  }
}

console.log(
  `${models.size} model(s) store uploads; the sweeper selects columns on ${selected.size}.\n`,
);

if (missing.length === 0) {
  for (const [model, cols] of models) {
    console.log(`  ok   ${model.padEnd(16)} ${cols.join(", ")}`);
  }
  console.log("\nEvery upload column is accounted for.");
  process.exit(0);
}

for (const [model, cols, why] of missing) {
  console.log(`  MISSING  ${model.padEnd(16)} ${cols.join(", ")}  — ${why}`);
}
console.log(
  `\n${missing.length} model(s) hold upload URLs that collectReferencedUrls never reads.\n` +
    "Until they are added, `media:sweep --apply` will treat those files as orphans\n" +
    "and delete them. Fix the select (and the loop that reads it) in\n" +
    "src/lib/media.ts.",
);
process.exit(1);
