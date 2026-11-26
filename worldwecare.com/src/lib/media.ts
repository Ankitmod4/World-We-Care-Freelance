/**
 * Media ownership and deletion — the single path for removing an
 * uploaded file from disk.
 *
 * ────────────────────────────────────────────────────────────────
 * THE RULE: a file is only ever deleted because an `UploadedFile` row
 * says who uploaded it. Never because some row mentions its URL.
 *
 * Post images, event photos and article covers are all URLs the client
 * supplied. Trusting them would mean a member could attach
 * "/uploads/logos/site-logo.png" to their own post, delete the post,
 * and take the site's logo down with it. The sister project shipped
 * exactly that hole; this is the fix, brought over.
 *
 * Three guards, all of which must pass:
 *   1. An UploadedFile row exists for the URL.
 *   2. When an owner is supplied, it matches the row's owner.
 *   3. The resolved path is inside public/uploads — so a `relPath`
 *      containing "../../.env" can never escape, even if the row was
 *      written by a future bug.
 * ────────────────────────────────────────────────────────────────
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "./db";
import { thumbUrlFor } from "./image-urls";
import { attachedImageUrls } from "./attached-media";

const PUBLIC_ROOT = path.join(process.cwd(), "public");
const UPLOAD_ROOT = path.join(PUBLIC_ROOT, "uploads");

export interface RecordUploadInput {
  url: string;
  relPath: string;
  category: string;
  bytes: number;
  mime?: string | null;
  ownerId?: string | null;
  ownerKind?: "USER" | "ADMIN" | "SYSTEM";
}

/** Called by every upload path, so every file has an owner from birth. */
export async function recordUpload(input: RecordUploadInput): Promise<void> {
  await prisma.uploadedFile
    .upsert({
      where: { url: input.url },
      create: {
        url: input.url,
        relPath: input.relPath,
        category: input.category,
        bytes: Math.max(0, Math.round(input.bytes)),
        mime: input.mime ?? null,
        ownerId: input.ownerId ?? null,
        ownerKind: input.ownerKind ?? "USER",
      },
      // A repeat upload to the same random filename is effectively
      // impossible, but an upsert makes this idempotent rather than a
      // 500 if it ever happens.
      update: { bytes: Math.max(0, Math.round(input.bytes)), mime: input.mime ?? null },
    })
    // Bookkeeping must never fail an upload the user can see succeeded.
    .catch((err) => {
      console.warn(`[media] could not record ${input.url}:`, err);
    });
}

/**
 * True when `relPath` resolves to somewhere inside public/uploads.
 * Exported because it is the guard worth testing directly.
 */
export function isInsideUploads(relPath: string): boolean {
  if (typeof relPath !== "string" || !relPath.trim()) return false;
  // A leading slash would make path.join treat it as absolute-ish on
  // some platforms; strip it and resolve from the public root.
  const resolved = path.resolve(PUBLIC_ROOT, relPath.replace(/^[/\\]+/, ""));
  return resolved === UPLOAD_ROOT || resolved.startsWith(UPLOAD_ROOT + path.sep);
}

export interface DeleteMediaResult {
  deleted: string[];
  /** URL → why it was left alone. Useful in logs and in tests. */
  skipped: Record<string, string>;
  bytesFreed: number;
}

/**
 * Delete uploaded files by their public URL.
 *
 * `ownerId` scopes the deletion: pass it for anything a member
 * triggers, omit it only for admin-initiated purges where the file's
 * owner is irrelevant (an admin deleting a member's post).
 */
export async function deleteMediaByUrls(
  urls: Array<string | null | undefined>,
  opts: { ownerId?: string | null; allowAnyOwner?: boolean } = {},
): Promise<DeleteMediaResult> {
  const result: DeleteMediaResult = { deleted: [], skipped: {}, bytesFreed: 0 };

  const given = urls.filter((u): u is string => typeof u === "string" && !!u.trim());
  // An image's thumbnail is never stored in any post or article — it is
  // derived from the URL — so nothing would ever ask for it by name.
  // Deleting a picture has to take its thumbnail with it, or every
  // delete leaves a small file behind forever.
  const withThumbs = given.flatMap((u) => {
    const t = thumbUrlFor(u);
    return t && t !== u ? [u, t] : [u];
  });

  const unique = [...new Set(withThumbs)];
  if (unique.length === 0) return result;

  const rows = await prisma.uploadedFile.findMany({ where: { url: { in: unique } } });
  const byUrl = new Map(rows.map((r) => [r.url, r]));

  for (const url of unique) {
    const row = byUrl.get(url);
    if (!row) {
      // GUARD 1 — not a file we recorded. Could be a CDN URL, an
      // external image, or someone probing. Either way: not ours.
      result.skipped[url] = "no upload record";
      continue;
    }
    if (!opts.allowAnyOwner && opts.ownerId && row.ownerId !== opts.ownerId) {
      // GUARD 2 — someone else's file.
      result.skipped[url] = "owned by someone else";
      continue;
    }
    if (!isInsideUploads(row.relPath)) {
      // GUARD 3 — should be unreachable, which is exactly why it is
      // checked rather than assumed.
      result.skipped[url] = "path outside the uploads directory";
      console.warn(`[media] refusing to delete ${row.relPath} — outside uploads`);
      continue;
    }

    const absolute = path.resolve(PUBLIC_ROOT, row.relPath.replace(/^[/\\]+/, ""));
    try {
      await fs.rm(absolute, { force: true });
    } catch (err) {
      result.skipped[url] = `could not remove file: ${err instanceof Error ? err.message : "unknown"}`;
      continue;
    }
    await prisma.uploadedFile.delete({ where: { id: row.id } }).catch(() => {});
    result.deleted.push(url);
    result.bytesFreed += row.bytes;
  }

  return result;
}

/** Markdown image URLs inside a body, so deleting a post or article
 *  takes its inline pictures too. Only local paths — an external image
 *  is not ours to delete, and `deleteMediaByUrls` would skip it
 *  anyway, but filtering here keeps the logs quiet. */
export function extractLocalImageUrls(markdown: string | null | undefined): string[] {
  if (!markdown) return [];
  const out: string[] = [];
  const re = /!\[[^\]]*\]\(([^)\s]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const url = m[1];
    if (url.startsWith("/uploads/")) out.push(url);
  }
  return out;
}

export interface StorageSummary {
  totalBytes: number;
  totalFiles: number;
  byCategory: Array<{ category: string; bytes: number; files: number }>;
  video: { bytes: number; count: number };
}

/**
 * What is on disk, and how much of it is unreferenced.
 *
 * The reference scan is the same one the sweeper uses, so the number
 * shown here is the number `sweep-media` would act on.
 */
/**
 * What is on disk, for the admin Storage page.
 *
 * NO ORPHAN COUNT ANY MORE, AND THAT IS THE POINT OF THIS NOTE.
 *
 * This used to return `orphanFiles` and `orphanBytes`, which meant
 * calling `collectReferencedUrls()` — eighteen table reads and a Set of
 * every upload URL the whole product references — on every single load
 * of the Storage page. The two numbers it produced were shown in one
 * "Reclaimable" tile and one sentence, both of which have been removed
 * along with the Media cleanup screen.
 *
 * So the scan went too. Nothing is lost: `npm run media:sweep` reports
 * exactly the same figures through `listOrphans`, which still does the
 * full scan — it just does it when somebody asks for it rather than
 * whenever an admin opens a settings page to check a disk total.
 */
export async function storageSummary(): Promise<StorageSummary> {
  const [grouped, files, videoAgg] = await Promise.all([
    prisma.uploadedFile.groupBy({
      by: ["category"],
      _sum: { bytes: true },
      _count: { _all: true },
    }),
    prisma.uploadedFile.findMany({ select: { url: true, bytes: true } }),
    prisma.videoAsset.aggregate({ _sum: { outputSize: true }, _count: { _all: true } }),
  ]);

  return {
    totalBytes: files.reduce((a, f) => a + f.bytes, 0),
    totalFiles: files.length,
    byCategory: grouped
      .map((g) => ({
        category: g.category,
        bytes: g._sum.bytes ?? 0,
        files: g._count._all,
      }))
      .sort((a, b) => b.bytes - a.bytes),
    video: { bytes: videoAgg._sum.outputSize ?? 0, count: videoAgg._count._all },
  };
}

/**
 * Every media URL still referenced by anything.
 *
 * IF YOU ADD A SURFACE THAT STORES AN UPLOAD URL, ADD IT HERE.
 * A missing table here means the sweeper deletes files that are still
 * in use — which is why the sweeper is dry-run by default and prints
 * what it would remove.
 */
export async function collectReferencedUrls(): Promise<Set<string>> {
  const refs = new Set<string>();
  const add = (u: unknown) => {
    if (typeof u === "string" && u.startsWith("/uploads/")) refs.add(u);
  };

  /*
   * A `video` JSON column holds TWO files — the converted MP4 and the
   * poster frame — and forgetting the poster is a subtler version of
   * forgetting the column: the video keeps playing, and the thumbnail
   * on every card pointing at it goes blank a day later.
   *
   * There were three copies of these four lines (posts, petitions, and
   * nearly the two walls) before this was one function.
   */
  const addVideoUrls = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    add((v as { url?: unknown }).url);
    add((v as { posterUrl?: unknown }).posterUrl);
  };

  /*
   * EVERY TABLE THAT CAN HOLD AN UPLOAD URL. If a model is missing
   * from this list its files look unreferenced, and `--apply` deletes
   * them — see the warning above, which is not hypothetical: this list
   * was eight models for a long time and the nine below were absent,
   * so the sweeper's own report offered up every gratitude photo,
   * every petition gallery and every town hero portrait as an
   * orphan.
   *
   * The rule when adding a column that stores an upload: add it here
   * in the same commit. `scripts/check-media-refs.ts` fails the build
   * if a likely-looking column exists that this function never reads.
   */
  const [
    posts, articles, events, themes, clips, users, settings, quotes,
    gratitude, petitions, heroes, places, campaigns, dms, assets,
    // ── pending the schema drop; see the note below ──
    confessions, banners,
  ] = await Promise.all([
    prisma.post.findMany({ select: { images: true, video: true, body: true } }),
    prisma.article.findMany({ select: { coverUrl: true, videoUrl: true, body: true, photos: true } }),
    prisma.event.findMany({ select: { coverUrl: true, photos: true, description: true } }),
    prisma.libraryTheme.findMany({ select: { coverUrl: true, about: true } }),
    prisma.clip.findMany({ select: { videoUrl: true, posterUrl: true } }),
    // `coverUrl` as well as the avatar — a profile banner is an upload.
    prisma.user.findMany({ select: { avatarUrl: true, coverUrl: true } }),
    prisma.platformSetting.findMany({ select: { value: true } }),
    prisma.dailyQuote.findMany({ select: { id: true } }).catch(() => []),

    // ── the nine that were missing ──
    // `video` AS WELL AS `imageUrl`. The wall grew a video column, and
    // selecting only the photo here is the same bug as leaving the
    // whole table out: the converted MP4 and its poster look
    // unreferenced, and `--apply` deletes them out from under a live
    // entry once the grace period passes.
    prisma.gratitudeEntry.findMany({ select: { imageUrl: true, video: true } }),
    prisma.petition.findMany({
      select: { coverUrl: true, photos: true, video: true, body: true },
    }),
    prisma.townHero.findMany({ select: { photoUrl: true } }),
    prisma.place.findMany({ select: { coverUrl: true, photos: true, about: true } }),
    prisma.campaign.findMany({ select: { coverUrl: true, photos: true, body: true } }),
    prisma.directMessage.findMany({ select: { imageUrl: true } }),
    prisma.videoAsset.findMany({ select: { posterUrl: true } }),

    /*
     * ── TWO TABLES FOR A FEATURE THAT NO LONGER EXISTS ──────────
     *
     * The confession wall and the page-banner system have been removed
     * from the product: no route renders them, no admin screen edits
     * them, nothing links to them. Their TABLES are still in
     * schema.prisma, and until those are dropped their rows still point
     * at real files on disk.
     *
     * So the sweeper still has to read them. Stop reading a table whose
     * rows survive and every file it references becomes an "orphan" —
     * and `media:sweep --apply` deletes orphans. That would permanently
     * delete every confession photo and video and every banner image
     * while the rows naming them were still there: the feature gone,
     * the data half-gone, and no way back if it is ever restored.
     *
     * DELETE THESE TWO QUERIES IN THE SAME COMMIT that drops
     * `Confession` and `PageBanner` from the schema — not before, and
     * not after. `npm run media:refs` fails while the two are out of
     * step in either direction, which is what makes the pairing
     * enforceable rather than a thing to remember.
     */
    prisma.confession.findMany({ select: { imageUrl: true, video: true } }),
    prisma.pageBanner.findMany({ select: { imageUrl: true } }),
  ]);
  void quotes;

  for (const p of posts) {
    if (Array.isArray(p.images)) for (const i of p.images) add((i as { url?: unknown })?.url);
    addVideoUrls(p.video);
    for (const u of extractLocalImageUrls(p.body)) add(u);
  }
  for (const a of articles) {
    add(a.coverUrl);
    add(a.videoUrl);
    // The gallery AND the inline images. Two different places an
    // article keeps photographs, and a sweep that read only one of
    // them would delete the other.
    for (const u of attachedImageUrls(a.photos)) add(u);
    for (const u of extractLocalImageUrls(a.body)) add(u);
  }
  for (const e of events) {
    add(e.coverUrl);
    if (Array.isArray(e.photos)) for (const p of e.photos) add((p as { url?: unknown })?.url);
    for (const u of extractLocalImageUrls(e.description)) add(u);
  }
  for (const f of themes) {
    add(f.coverUrl);
    for (const u of extractLocalImageUrls(f.about)) add(u);
  }
  for (const c of clips) {
    add(c.videoUrl);
    add(c.posterUrl);
  }
  for (const u of users) {
    add(u.avatarUrl);
    add(u.coverUrl);
  }

  // ── the nine ──
  for (const g of gratitude) {
    add(g.imageUrl);
    addVideoUrls(g.video);
  }
  // Removed features, live rows — see the note on the queries above.
  for (const c of confessions) {
    add(c.imageUrl);
    addVideoUrls(c.video);
  }
  for (const bnr of banners) add(bnr.imageUrl);
  for (const p of petitions) {
    add(p.coverUrl);
    for (const u of attachedImageUrls(p.photos)) add(u);
    addVideoUrls(p.video);
    for (const u of extractLocalImageUrls(p.body)) add(u);
  }
  for (const h of heroes) add(h.photoUrl);
  for (const pl of places) {
    add(pl.coverUrl);
    for (const u of attachedImageUrls(pl.photos)) add(u);
    for (const u of extractLocalImageUrls(pl.about)) add(u);
  }
  for (const c of campaigns) {
    add(c.coverUrl);
    for (const u of attachedImageUrls(c.photos)) add(u);
    for (const u of extractLocalImageUrls(c.body)) add(u);
  }
  for (const m of dms) add(m.imageUrl);
  // A poster belongs to its asset even before anything attaches it.
  for (const a of assets) add(a.posterUrl);

  // Site logo, favicon and any other setting that holds a URL.
  for (const s of settings) add(s.value);

  // Thumbnails are derived, not stored, so nothing above can have
  // named one. Every referenced image implicitly references its
  // thumbnail — without this the sweeper would report every thumbnail
  // on the server as an orphan and offer to delete the lot.
  for (const u of [...refs]) {
    const t = thumbUrlFor(u);
    if (t && t !== u) refs.add(t);
  }

  return refs;
}

/* ── orphans ─────────────────────────────────────────────────── */

export interface OrphanFile {
  id: string;
  url: string;
  category: string;
  bytes: number;
  mime: string | null;
  ownerId: string | null;
  createdAt: string;
}

export interface OrphanVideo {
  id: string;
  status: string;
  originalName: string;
  bytes: number;
  url: string | null;
  posterUrl: string | null;
  durationSec: number | null;
  createdAt: string;
}

export interface OrphanReport {
  files: OrphanFile[];
  videos: OrphanVideo[];
  fileBytes: number;
  videoBytes: number;
  /** How recent an item has to be to be left alone, in hours. */
  graceHours: number;
}

/**
 * Everything nothing points at any more.
 *
 * Shared by the admin cleanup page and `prisma/sweep-media.ts`, so the
 * list you look at in the browser and the list the cron job acts on
 * are produced by the same code. Two implementations of "is this
 * referenced?" would eventually disagree, and the disagreement would
 * be discovered by something being deleted that shouldn't have been.
 *
 * The grace period protects an upload that is mid-flow: converted,
 * sitting in a composer, not yet attached to anything.
 */
export async function listOrphans(graceHours = 24): Promise<OrphanReport> {
  const cutoff = new Date(Date.now() - Math.max(0, graceHours) * 3600_000);

  /*
   * EVERY TABLE THAT CAN ATTACH A VideoAsset, and the reason this is a
   * list rather than four hand-written queries.
   *
   * An asset nothing in here points at is an orphan, and orphans are
   * what `--apply` deletes. This read `clip` and `post` and nothing
   * else, which meant PETITION videos were already being offered up —
   * a member's petition video, still playing on its page, listed as
   * deletable the day after it was uploaded. Adding the two walls
   * without noticing would have made it four surfaces.
   *
   * `clip` is not in here because it stores the id in a real column
   * (`videoAssetId`) rather than inside a JSON blob; it is queried
   * separately below.
   */
  // `confession` is still here for the same reason the sweeper still
  // reads the table above: the rows exist, so the VideoAssets they name
  // are still attached, and dropping it from this list would make every
  // confession video an orphan the day before the table goes. Remove it
  // in the commit that drops the model.
  const VIDEO_JSON_TABLES = ["post", "petition", "gratitudeEntry", "confession"] as const;

  const [referenced, files, clipAssets, jsonVideoRows, assets] = await Promise.all([
    collectReferencedUrls(),
    prisma.uploadedFile.findMany({
      where: { createdAt: { lt: cutoff } },
      orderBy: { bytes: "desc" },
      select: {
        id: true, url: true, category: true, bytes: true,
        mime: true, ownerId: true, createdAt: true,
      },
    }),
    prisma.clip.findMany({
      where: { videoAssetId: { not: null } },
      select: { videoAssetId: true },
    }),
    /*
     * One query per table, flattened to a single list of `video`
     * blobs. Written as a map over VIDEO_JSON_TABLES rather than four
     * literal calls so that the list above is the only place a fifth
     * surface has to be named — the previous shape invited exactly the
     * omission it suffered from.
     *
     * The cast is needed because TypeScript cannot narrow
     * `prisma[name]` across a union of delegates; the names are a
     * const tuple, so a typo is still a compile error.
     */
    Promise.all(
      VIDEO_JSON_TABLES.map((t) =>
        (prisma[t] as { findMany: (a: unknown) => Promise<Array<{ video: unknown }>> }).findMany({
          select: { video: true },
        }),
      ),
    ).then((lists) => lists.flat()),
    prisma.videoAsset.findMany({
      where: { createdAt: { lt: cutoff } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, status: true, originalName: true, outputSize: true,
        originalSize: true, url: true, posterUrl: true, durationSec: true, createdAt: true,
      },
    }),
  ]);

  const attached = new Set<string>();
  for (const c of clipAssets) if (c.videoAssetId) attached.add(c.videoAssetId);
  for (const row of jsonVideoRows) {
    const id = (row.video as { assetId?: unknown } | null)?.assetId;
    if (typeof id === "string" && id) attached.add(id);
  }

  const orphanFiles = files
    .filter((f) => !referenced.has(f.url))
    .map((f) => ({ ...f, createdAt: f.createdAt.toISOString() }));

  const orphanVideos = assets
    .filter((a) => !attached.has(a.id))
    .map((a) => ({
      id: a.id,
      status: a.status as string,
      originalName: a.originalName,
      // A conversion that never finished has no output size; the
      // source file it left behind is the thing taking up room.
      bytes: a.outputSize ?? a.originalSize ?? 0,
      url: a.url,
      posterUrl: a.posterUrl,
      durationSec: a.durationSec,
      createdAt: a.createdAt.toISOString(),
    }));

  return {
    files: orphanFiles,
    videos: orphanVideos,
    fileBytes: orphanFiles.reduce((a, f) => a + f.bytes, 0),
    videoBytes: orphanVideos.reduce((a, v) => a + v.bytes, 0),
    graceHours,
  };
}

export interface DeleteOrphansResult {
  filesDeleted: number;
  videosDeleted: number;
  bytesFreed: number;
  skipped: string[];
}

/**
 * Delete a chosen set of orphans.
 *
 * Every id is RE-CHECKED against a fresh orphan list before anything
 * is removed. The page the admin is looking at may be minutes old, and
 * in between someone could have attached that very video to a post —
 * deleting what the browser was told was garbage is exactly the bug
 * this guards against.
 */
export async function deleteOrphans(
  input: { fileIds?: string[]; videoIds?: string[] },
  actor: { id: string },
  graceHours = 24,
): Promise<DeleteOrphansResult> {
  const current = await listOrphans(graceHours);
  const stillOrphanFiles = new Map(current.files.map((f) => [f.id, f]));
  const stillOrphanVideos = new Map(current.videos.map((v) => [v.id, v]));

  const result: DeleteOrphansResult = {
    filesDeleted: 0,
    videosDeleted: 0,
    bytesFreed: 0,
    skipped: [],
  };

  for (const id of input.fileIds ?? []) {
    const file = stillOrphanFiles.get(id);
    if (!file) {
      result.skipped.push(id);
      continue;
    }
    // Goes through the same three guards as every other deletion.
    const outcome = await deleteMediaByUrls([file.url], { allowAnyOwner: true });
    if (outcome.deleted.length === 0) {
      result.skipped.push(id);
      continue;
    }
    result.filesDeleted += 1;
    result.bytesFreed += outcome.bytesFreed;
  }

  for (const id of input.videoIds ?? []) {
    const video = stillOrphanVideos.get(id);
    if (!video) {
      result.skipped.push(id);
      continue;
    }
    const { discardVideo } = await import("./video-status");
    const ok = await discardVideo(id, { id: actor.id, isAdmin: true }).catch(() => false);
    if (!ok) {
      result.skipped.push(id);
      continue;
    }
    result.videosDeleted += 1;
    result.bytesFreed += video.bytes;
  }

  return result;
}
