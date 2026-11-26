/**
 * Generate thumbnails for images uploaded before the resizer existed.
 *
 * WALKS THE DISK, NOT THE DATABASE. The first version of this script
 * queried `UploadedFile` and quietly did almost nothing: uploads
 * predating that table have no row, so ten of twelve images were
 * invisible to it while the two most recent ones worked — which looks
 * exactly like a working script until you count the files.
 *
 * The question being asked is "which files on disk have no thumbnail",
 * and the only thing that can answer it is the filesystem.
 *
 * Every image keeps its original file and URL — nothing stored in a
 * post or article is rewritten, because rewriting content to point at
 * new filenames is how you end up with broken pictures and no way
 * back. All this does is put a `-thumb.webp` sibling next to each
 * eligible image so `thumbUrlFor` starts resolving instead of 404ing.
 *
 * ELIGIBLE is every raster image: JPEG, PNG and WebP alike, since the
 * thumbnail is always WebP whatever the source was. SVG, GIF and ICO
 * are skipped — a vector has nothing to resample and a GIF would lose
 * its animation.
 *
 * An `UploadedFile` row is created for the thumbnail ONLY when its
 * parent has one. That keeps the pair consistent: a parent the orphan
 * sweeper cannot see gets a thumbnail it cannot see either, so neither
 * can be half-deleted later.
 *
 * Idempotent. Run it as often as you like.
 *
 *   npx tsx prisma/backfill-thumbs.ts          # report only
 *   npx tsx prisma/backfill-thumbs.ts --apply  # write them
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { MAX_INPUT_PIXELS, THUMB_MAX_EDGE, THUMB_SUFFIX } from "../src/lib/image-variants";

const prisma = new PrismaClient();
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
const PUBLIC_ROOT = path.join(process.cwd(), "public");
const APPLY = process.argv.includes("--apply");

const ELIGIBLE = new Set([".jpg", ".jpeg", ".png", ".webp"]);

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.isFile()) yield full;
  }
}

async function main() {
  console.log(APPLY ? "Backfilling thumbnails…\n" : "Dry run — nothing will be written.\n");

  let made = 0;
  let already = 0;
  let ineligible = 0;
  let tooSmall = 0;
  let failed = 0;
  let bytesIn = 0;
  let bytesOut = 0;

  for await (const abs of walk(UPLOADS_ROOT)) {
    const ext = path.extname(abs).toLowerCase();
    const stem = path.basename(abs, ext);

    if (stem.endsWith(THUMB_SUFFIX)) continue;      // it IS a thumbnail
    if (!ELIGIBLE.has(ext)) {
      // .DS_Store, .svg, .gif, videos — not our business.
      if (/\.(svg|gif|ico|avif)$/i.test(ext)) ineligible += 1;
      continue;
    }

    const thumbAbs = path.join(path.dirname(abs), `${stem}${THUMB_SUFFIX}.webp`);
    if (await exists(thumbAbs)) {
      already += 1;
      continue;
    }

    const rel = `/${path.relative(PUBLIC_ROOT, abs).split(path.sep).join("/")}`;
    const thumbRel = `/${path.relative(PUBLIC_ROOT, thumbAbs).split(path.sep).join("/")}`;

    try {
      const meta = await sharp(abs, { failOn: "none", limitInputPixels: false }).metadata();
      const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
      if (!longEdge) {
        failed += 1;
        console.log(`  unreadable  ${rel}`);
        continue;
      }
      if ((meta.width ?? 0) * (meta.height ?? 0) > MAX_INPUT_PIXELS) {
        failed += 1;
        console.log(`  too large   ${rel}`);
        continue;
      }
      if (longEdge <= THUMB_MAX_EDGE) {
        // Already small. A "thumbnail" would be the same picture again,
        // and `<Img>` falling back to the original is the right answer.
        tooSmall += 1;
        continue;
      }

      const out = await sharp(abs, {
        failOn: "none",
        limitInputPixels: MAX_INPUT_PIXELS,
        sequentialRead: true,
      })
        .rotate()
        .resize({
          width: THUMB_MAX_EDGE,
          height: THUMB_MAX_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 72 })
        .toBuffer();

      const sourceBytes = (await fs.stat(abs)).size;

      if (APPLY) {
        await fs.writeFile(thumbAbs, out);

        // Mirror the parent's bookkeeping — see the header.
        const parent = await prisma.uploadedFile
          .findFirst({ where: { relPath: rel }, select: { category: true, ownerId: true, ownerKind: true, url: true } })
          .catch(() => null);
        if (parent) {
          const thumbUrl = parent.url.replace(/\.[^./?#]+($|[?#])/, `${THUMB_SUFFIX}.webp$1`);
          await prisma.uploadedFile
            .create({
              data: {
                url: thumbUrl,
                relPath: thumbRel,
                category: parent.category,
                bytes: out.byteLength,
                mime: "image/webp",
                ownerId: parent.ownerId,
                ownerKind: parent.ownerKind,
              },
            })
            .catch(() => {});
        }
      }

      made += 1;
      bytesIn += sourceBytes;
      bytesOut += out.byteLength;
      console.log(
        `  ${APPLY ? "wrote" : "would"}   ${thumbRel}  ${kb(sourceBytes)} → ${kb(out.byteLength)}`,
      );
    } catch (err) {
      failed += 1;
      console.log(`  failed      ${rel} — ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  console.log(
    `\n${made} thumbnail${made === 1 ? "" : "s"} ${APPLY ? "written" : "to write"}` +
      (made ? `  (${kb(bytesIn)} of originals → ${kb(bytesOut)} of thumbnails)` : "") +
      `\n${already} already had one, ${tooSmall} already small enough, ` +
      `${ineligible} not resizable (svg/gif/ico), ${failed} failed.`,
  );
  if (!APPLY && made > 0) console.log("\nRe-run with --apply to write them.");
}

async function exists(p: string): Promise<boolean> {
  return fs.access(p).then(() => true).catch(() => false);
}

function kb(n: number): string {
  return n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(2)} MB`;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
