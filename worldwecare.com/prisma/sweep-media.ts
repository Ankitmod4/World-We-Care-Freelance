/**
 * Reclaim storage from media nothing points at any more.
 *
 * Two kinds of waste:
 *
 *  1. ABANDONED VIDEO UPLOADS. Someone picks a file, the conversion
 *     runs, and then they close the tab without posting. The MP4, its
 *     poster and the source file all stay on disk with nothing
 *     referencing them. On a server that converts 2 GB uploads this is
 *     by far the biggest leak.
 *
 *  2. ORPHANED FILES. An article cover that was replaced, photos from
 *     a draft that was never saved, an image removed from a post
 *     before publishing.
 *
 * ────────────────────────────────────────────────────────────────
 * DRY RUN BY DEFAULT. It prints what it would delete and exits. Pass
 * --apply to actually remove anything.
 *
 * That default is deliberate. Deciding a file is unreferenced means
 * checking every table that can hold an upload URL — see
 * `collectReferencedUrls` in src/lib/media.ts. Miss one and this
 * deletes live files. So: read the list first, then apply.
 * ────────────────────────────────────────────────────────────────
 *
 * A grace period (default 24h) protects an upload that is mid-flow —
 * converted, on screen, but not yet attached to anything.
 *
 * The same lists are available in the admin UI at
 * Settings → Media cleanup, which calls the very same functions.
 *
 * Run:
 *   npx tsx prisma/sweep-media.ts               # report only
 *   npx tsx prisma/sweep-media.ts --apply
 *   npx tsx prisma/sweep-media.ts --apply --hours=72
 *
 * Nightly cron, from the project directory:
 *   0 4 * * *  cd /var/www/worldwecare && npx tsx prisma/sweep-media.ts --apply >> /var/log/wwc-sweep.log 2>&1
 */

import { PrismaClient } from "@prisma/client";
import { deleteOrphans, listOrphans } from "../src/lib/media";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const HOURS = (() => {
  const arg = process.argv.find((a) => a.startsWith("--hours="));
  const n = arg ? Number(arg.split("=")[1]) : 24;
  return Number.isFinite(n) && n >= 0 ? n : 24;
})();

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function main() {
  console.log(
    `${APPLY ? "APPLYING" : "DRY RUN"} — anything created in the last ${HOURS}h is left alone.\n`,
  );

  const report = await listOrphans(HOURS);

  console.log(`Video uploads attached to nothing: ${report.videos.length}`);
  for (const v of report.videos) {
    console.log(
      `  ${v.id}  ${v.status.padEnd(10)} ${mb(v.bytes).padStart(9)}  ${v.originalName.slice(0, 40)}`,
    );
  }

  console.log(`\nUploaded files referenced by nothing: ${report.files.length}`);
  for (const f of report.files) {
    console.log(`  ${f.category.padEnd(10)} ${mb(f.bytes).padStart(9)}  ${f.url}`);
  }

  const total = report.fileBytes + report.videoBytes;
  const count = report.files.length + report.videos.length;

  if (!APPLY) {
    console.log(
      `\nWould free ${mb(total)} (${mb(report.videoBytes)} video, ` +
        `${mb(report.fileBytes)} other) across ${count} item(s).`,
    );
    if (count > 0) {
      console.log("Nothing was deleted. Re-run with --apply once the list above looks right.");
    }
    return;
  }

  const result = await deleteOrphans(
    { fileIds: report.files.map((f) => f.id), videoIds: report.videos.map((v) => v.id) },
    { id: "sweeper" },
    HOURS,
  );
  console.log(
    `\nFreed ${mb(result.bytesFreed)} — ${result.filesDeleted} file(s), ` +
      `${result.videosDeleted} video(s)` +
      (result.skipped.length ? `, ${result.skipped.length} skipped (re-checked and still in use)` : ""),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
