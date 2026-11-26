/**
 * Put PLACEHOLDER photos into the petition, place, campaign and
 * article galleries so the feature can be looked at before anybody has
 * uploaded anything.
 *
 *   npm run db:seed-gallery-placeholders
 *   npm run db:seed-gallery-placeholders -- --only=petitions,articles
 *   npm run db:seed-gallery-placeholders -- --clear
 *
 * ─────────────────────────────────────────────────────────────────
 * SEPARATE COMMAND, DELIBERATELY.
 *
 * The content seeds (`db:seed-petitions`, `db:seed-places`) create
 * real rows and are safe to reason about. This one decorates them
 * with pictures nobody chose, which is fine for a demo and wrong on a
 * production site: a random photograph is a claim about what a thing
 * is, and "Keep the Riverside animal shelter open" illustrated by
 * whatever came back for its seed is a worse page than one with no
 * picture at all. Keeping it out of the content seeds means running
 * those can never drag this in.
 * ─────────────────────────────────────────────────────────────────
 *
 * NEVER OVERWRITES A REAL GALLERY. A row holding even one genuine
 * upload is left exactly as it is. The rows touched are the empty
 * ones and the ones still holding THIS FILE's own placeholders, which
 * are resized to the current count — otherwise changing that count
 * would do nothing on a database that had already been seeded.
 *
 * `/seed/<slug>-<n>/` rather than a random id: picsum returns the same
 * photo for the same seed, so a petition keeps its pictures across
 * runs instead of reshuffling on every deploy.
 *
 * THESE ARE REMOTE URLS, so they never touch `public/uploads` and the
 * media sweeper has nothing to do with them — which is also why
 * `--clear` exists here rather than leaning on `banners:clear`. That
 * one matches the banner's exact 1600x520 shape and will not touch
 * these.
 *
 * ALT TEXT IS LEFT EMPTY on purpose. Alt text describing a photograph
 * nobody chose would be a second invented claim on top of the first;
 * an empty alt marks it decorative, which is what a placeholder is.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const CLEAR = args.includes("--clear");
const ONLY = (args.find((a) => a.startsWith("--only="))?.split("=")[1] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

type Kind = "petitions" | "places" | "campaigns" | "articles";

/**
 * How many pictures each gallery gets.
 *
 * Every kind gets a FULL gallery (8-10), because that is the case the
 * grid has to survive: the thumbnails cap at two rows and fold the
 * rest into a `+N`, and a demo of four photos never reaches that
 * badge on any screen. Eight is already past it on a phone, ten is
 * past it on a desktop — so the seeded pages show the overflow
 * behaviour instead of hiding it until real uploads arrive.
 *
 * Ten is the ceiling because it is `MAX_GALLERY_PHOTOS` in
 * src/lib/attached-media.ts — seeding more than an editor is allowed
 * to upload would make the seeded pages a liar about the product.
 * Not imported: nothing in prisma/ reaches into src/, and a seed that
 * needs the app's module graph to run is a seed that breaks on a
 * server where only the schema was deployed.
 *
 * To give one kind a smaller gallery again, put a plain number back
 * in place of its range — `places: 4` — and re-run. The refill below
 * will resize what it already wrote.
 */
const MAX_GALLERY_PHOTOS = 10;
const PER_GALLERY: Record<Kind, number | [number, number]> = {
  petitions: [8, MAX_GALLERY_PHOTOS],
  places: [8, MAX_GALLERY_PHOTOS],
  campaigns: [8, MAX_GALLERY_PHOTOS],
  articles: [8, MAX_GALLERY_PHOTOS],
};

/**
 * A stable count inside the range, derived from the slug.
 *
 * Not `Math.random()`: this file is deterministic on purpose, so that
 * re-running it after a `--clear` gives a petition the same gallery
 * back rather than quietly reshuffling how many photos it has.
 */
function countFor(kind: Kind, slug: string): number {
  const spec = PER_GALLERY[kind];
  if (typeof spec === "number") return spec;
  const [lo, hi] = spec;
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return lo + (h % (hi - lo + 1));
}

const urlFor = (slug: string, n: number) =>
  `https://picsum.photos/seed/${slug}-g${n}/1200/900`;

/** Matches only what this file writes, so --clear cannot eat a real upload. */
const MINE = /^https:\/\/picsum\.photos\/seed\/[^/]+-g\d+\/1200\/900$/;

interface Row {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  photos: unknown;
}


const wanted = (k: Kind) => ONLY.length === 0 || ONLY.includes(k);

async function rowsFor(kind: Kind): Promise<Row[]> {
  if (kind === "petitions") {
    return prisma.petition.findMany({
      select: { id: true, slug: true, title: true, coverUrl: true, photos: true },
    });
  }
  if (kind === "places") {
    return (
      await prisma.place.findMany({
        select: { id: true, slug: true, name: true, coverUrl: true, photos: true },
      })
    ).map((p) => ({ ...p, title: p.name }));
  }
  if (kind === "campaigns") {
    return prisma.campaign.findMany({
      select: { id: true, slug: true, title: true, coverUrl: true, photos: true },
    });
  }
  return prisma.article.findMany({
    select: { id: true, slug: true, title: true, coverUrl: true, photos: true },
  });
}

async function write(kind: Kind, id: string, data: { coverUrl?: string | null; photos: unknown }) {
  const payload = data as never;
  if (kind === "petitions") return prisma.petition.update({ where: { id }, data: payload });
  if (kind === "places") return prisma.place.update({ where: { id }, data: payload });
  if (kind === "campaigns") return prisma.campaign.update({ where: { id }, data: payload });
  return prisma.article.update({ where: { id }, data: payload });
}

async function run(kind: Kind) {
  if (!wanted(kind)) return;
  const rows = await rowsFor(kind);
  if (rows.length === 0) {
    console.log(`\n${kind}: nothing in the database yet — run its content seed first.`);
    return;
  }

  console.log(`\n${kind} (${rows.length})`);
  let touched = 0;
  let kept = 0;

  for (const row of rows) {
    const existing = Array.isArray(row.photos) ? row.photos : [];

    if (CLEAR) {
      const isPlaceholder =
        existing.length > 0 &&
        existing.every((p) => MINE.test(String((p as { url?: unknown })?.url ?? "")));
      const coverIsMine = !!row.coverUrl && MINE.test(row.coverUrl);
      if (!isPlaceholder && !coverIsMine) {
        kept += 1;
        continue;
      }
      await write(kind, row.id, {
        photos: null,
        ...(coverIsMine ? { coverUrl: null } : {}),
      });
      touched += 1;
      console.log(`  cleared  ${row.title.slice(0, 52)}`);
      continue;
    }

    // A gallery this file wrote on an earlier run is NOT a real gallery,
    // so it is resized rather than treated as somebody's work. Without
    // this, changing the count above did nothing on any database that
    // had already been seeded: every row had photos, so every row was
    // skipped, and the old count stayed on the page for ever.
    //
    // The test is the URL shape, the same one `--clear` uses. A row
    // holding even one genuine upload fails it and is left alone, which
    // is the guarantee that actually matters here.
    const isMine =
      existing.length > 0 &&
      existing.every((ph) => MINE.test(String((ph as { url?: unknown })?.url ?? "")));

    if (existing.length > 0 && !isMine) {
      kept += 1;
      console.log(`  kept     ${row.title.slice(0, 52)} — already has photos`);
      continue;
    }

    const count = countFor(kind, row.slug);
    const photos = Array.from({ length: count }, (_, i) => ({
      url: urlFor(row.slug, i + 1),
      alt: null,
    }));

    // Same pictures, same number: nothing to say and nothing to write.
    // Keeps a re-run a genuine no-op rather than a silent rewrite of
    // every row in the table.
    if (
      isMine &&
      existing.length === count &&
      existing.every((ph, i) => String((ph as { url?: unknown })?.url ?? "") === photos[i].url)
    ) {
      kept += 1;
      continue;
    }

    await write(kind, row.id, {
      photos,
      // A gallery on a row with no cover leaves the card blank while
      // the page is full of pictures, which reads as broken rather
      // than as undecorated. Only filled when it is empty.
      ...(row.coverUrl ? {} : { coverUrl: urlFor(row.slug, 0) }),
    });
    touched += 1;
    console.log(
      isMine
        ? `  refilled ${row.title.slice(0, 52)} — was ${existing.length}, now ${count}`
        : `  added    ${row.title.slice(0, 52)} — ${count} photos${row.coverUrl ? "" : " + cover"}`,
    );
  }

  console.log(`  ${CLEAR ? "cleared" : "filled"} ${touched}, left alone ${kept}.`);
}

async function main() {
  console.log(
    CLEAR
      ? "Removing placeholder gallery photos…"
      : "Filling empty galleries with placeholder photos…",
  );
  if (ONLY.length) console.log(`  (only: ${ONLY.join(", ")})`);

  await run("petitions");
  await run("places");
  await run("campaigns");
  await run("articles");

  if (!CLEAR) {
    console.log(
      "\n  These are STAND-INS, not choices. Swap them for real pictures in the admin —\n" +
        "  petitions and places at their edit pages, campaigns and articles at their\n" +
        "  edit pages too — or take\n" +
        "  them all back out with `npm run db:seed-gallery-placeholders -- --clear`.\n" +
        "  Nothing here is stored on the server, so the media sweeper is not involved.",
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
