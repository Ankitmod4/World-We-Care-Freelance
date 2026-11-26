/**
 * Backfill thumbnails for videos converted before the poster bug was
 * fixed.
 *
 * The poster was written to a path ending in `.part`, and ffmpeg infers
 * its muxer from the file extension — so it failed with "Unable to find
 * a suitable output format", the error was swallowed, and every
 * uploaded video ended up with `posterUrl: null`. The conversion itself
 * was fine; only the thumbnail is missing.
 *
 * This regenerates the poster from the already-converted MP4 — no
 * re-encoding, no re-upload — and repoints the clips and posts that
 * reference it.
 *
 * Safe to re-run: assets that already have a poster are skipped.
 *
 * Run:
 *   npx tsx prisma/backfill-posters.ts
 */

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { Prisma, PrismaClient } from "@prisma/client";

const run = promisify(execFile);
const prisma = new PrismaClient();

const VIDEO_DIR = path.join(process.cwd(), "public", "uploads", "videos");

async function findFfmpeg(): Promise<string | null> {
  const candidates = [
    process.env.FFMPEG_PATH?.trim(),
    path.join(process.env.FFMPEG_HOME || path.join(process.cwd(), ".ffmpeg"), "bin", "ffmpeg"),
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    try {
      await fs.access(c);
      return c;
    } catch {
      /* keep looking */
    }
  }
  try {
    const { stdout } = await run("which", ["ffmpeg"]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function main() {
  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) {
    console.error("ffmpeg not found. Install it first (Admin → Settings → Media / ffmpeg).");
    process.exit(1);
  }

  const assets = await prisma.videoAsset.findMany({
    where: { status: "READY", posterUrl: null },
    select: { id: true, url: true, durationSec: true },
  });
  console.log(`${assets.length} converted video(s) with no thumbnail.`);

  let fixed = 0;
  for (const asset of assets) {
    const mp4 = path.join(VIDEO_DIR, `${asset.id}.mp4`);
    const finalJpg = path.join(VIDEO_DIR, `${asset.id}.jpg`);
    // A real .jpg extension on the temp file too — that was the bug.
    const tmpJpg = path.join(VIDEO_DIR, `.${asset.id}.poster.jpg`);

    try {
      await fs.access(mp4);
    } catch {
      console.log(`  skip ${asset.id} — the mp4 is gone`);
      continue;
    }

    const at = asset.durationSec && asset.durationSec > 3
      ? Math.min(asset.durationSec * 0.1, 10)
      : 0;

    try {
      await run(
        ffmpeg,
        [
          "-hide_banner", "-nostdin", "-loglevel", "error", "-y",
          "-ss", at.toFixed(3),
          "-i", mp4,
          "-frames:v", "1",
          "-vf", "scale=w='min(1280,iw)':h=-2",
          "-q:v", "3",
          "-f", "image2",
          "-c:v", "mjpeg",
          tmpJpg,
        ],
        { timeout: 60_000 },
      );
      const st = await fs.stat(tmpJpg);
      if (st.size <= 0) throw new Error("empty poster");
      await fs.rename(tmpJpg, finalJpg);
    } catch (err) {
      await fs.rm(tmpJpg, { force: true }).catch(() => {});
      console.log(`  fail ${asset.id} — ${err instanceof Error ? err.message : "unknown"}`);
      continue;
    }

    const posterUrl = `/uploads/videos/${asset.id}.jpg`;
    await prisma.videoAsset.update({ where: { id: asset.id }, data: { posterUrl } });

    // Clips copy the poster at creation time, so they need repointing.
    const clips = await prisma.clip.updateMany({
      where: { videoAssetId: asset.id },
      data: { posterUrl },
    });

    // Posts keep it inside a JSON blob — read, patch, write.
    const posts = await prisma.post.findMany({
      where: { video: { not: Prisma.DbNull } },
      select: { id: true, video: true },
    });
    let patchedPosts = 0;
    for (const post of posts) {
      const v = post.video as Record<string, unknown> | null;
      if (!v || v.assetId !== asset.id || v.posterUrl) continue;
      await prisma.post.update({
        where: { id: post.id },
        data: { video: { ...v, posterUrl } },
      });
      patchedPosts += 1;
    }

    fixed += 1;
    console.log(`  ok   ${asset.id} → ${posterUrl} (${clips.count} clip(s), ${patchedPosts} post(s))`);
  }

  console.log(`\nDone: ${fixed}/${assets.length} thumbnails regenerated.`);
}


main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
