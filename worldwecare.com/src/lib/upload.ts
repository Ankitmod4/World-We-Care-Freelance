/**
 * File upload — local disk implementation.
 *
 * Files land in `public/uploads/<category>/<random>.<ext>` so
 * nginx serves them directly at `/uploads/...`. Later this becomes a
 * pluggable interface (S3, R2, etc.) but the surface is the same:
 * `uploadFile(buffer, filename, mime, category) -> { url }`.
 *
 * Photographs are resized and re-encoded on the way in — see
 * `image-variants.ts` for what and why. Two files land per image: the
 * one the URL names, and a `-thumb` sibling beside it. Both get their
 * own UploadedFile row, so the orphan sweeper counts them and the
 * delete path can find them.
 *
 * Server-only — imports node:fs, don't reach for this from a client
 * component.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getSetting } from "./settings";
import { DEFAULT_MAX_FILE_MB } from "./upload-limits";
import { recordUpload } from "./media";
import { THUMB_SUFFIX, processImage } from "./image-variants";

const PUBLIC_ROOT = path.join(process.cwd(), "public");

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

function extForMime(mime: string, fallbackName: string): string {
  switch (mime) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/svg+xml":
      return ".svg";
    case "image/x-icon":
    case "image/vnd.microsoft.icon":
      return ".ico";
    default: {
      // Fall back to the extension the caller provided.
      const dot = fallbackName.lastIndexOf(".");
      return dot >= 0 ? fallbackName.slice(dot).toLowerCase() : "";
    }
  }
}

export interface UploadResult {
  ok: boolean;
  url?: string;
  /** Present when a thumbnail was generated. Derivable from `url`
   *  too — see `thumbUrlFor` — this is just the direct answer. */
  thumbUrl?: string;
  width?: number | null;
  height?: number | null;
  error?: string;
}

export async function uploadFile(
  buf: Buffer | Uint8Array,
  originalName: string,
  mime: string,
  category: string,
  /**
   * Who is uploading. Recorded against the file so it can later be
   * deleted safely — see src/lib/media.ts. Optional so an internal
   * caller (a seed, say) can write a SYSTEM-owned file.
   */
  owner?: { id: string | null; kind: "USER" | "ADMIN" | "SYSTEM" },
): Promise<UploadResult> {
  if (!ALLOWED_MIME.has(mime)) {
    return { ok: false, error: `Unsupported file type: ${mime}` };
  }
  const maxMB = await getSetting<number>("storage.maxFileMB", DEFAULT_MAX_FILE_MB);
  if (buf.byteLength > maxMB * 1024 * 1024) {
    return { ok: false, error: `File larger than ${maxMB} MB limit.` };
  }

  // The size limit is checked against what was UPLOADED, above, not
  // against what we store — otherwise a 20 MB photo would sneak past a
  // 5 MB limit by virtue of compressing well.
  const image = await processImage(Buffer.from(buf), mime);
  // A decompression bomb is the one case worth refusing outright: the
  // file is small enough to pass the size limit and would expand to
  // gigabytes if anything ever decoded it.
  if (image.refused) {
    return { ok: false, error: image.refused };
  }

  const safeCategory = category.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "misc";
  const rand = crypto.randomBytes(8).toString("hex");
  const stem = `${Date.now().toString(36)}-${rand}`;
  const ext = image.processed ? image.ext : extForMime(mime, originalName);
  const filename = `${stem}${ext}`;
  const thumbName = image.thumb ? `${stem}${THUMB_SUFFIX}${ext}` : null;

  const dir = path.join(PUBLIC_ROOT, "uploads", safeCategory);
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), image.full.buf);
    if (thumbName && image.thumb) {
      await fs.writeFile(path.join(dir, thumbName), image.thumb.buf);
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to write file",
    };
  }

  // Optional public CDN prefix. When set, we return the CDN URL so
  // <img src> hits the edge; when not, the Next static server handles
  // /uploads/... directly.
  const cdnBase = await getSetting<string>("storage.publicBaseUrl", "");
  const prefix = cdnBase ? cdnBase.replace(/\/$/, "") : "";
  const relative = `/uploads/${safeCategory}/${filename}`;
  const url = `${prefix}${relative}`;
  const relativeThumb = thumbName ? `/uploads/${safeCategory}/${thumbName}` : null;
  const thumbUrl = relativeThumb ? `${prefix}${relativeThumb}` : undefined;

  // Ownership record. `relPath` is the on-disk path and stays free of
  // any CDN prefix — deletion must never be derived from a public URL.
  await recordUpload({
    url,
    relPath: relative,
    category: safeCategory,
    bytes: image.full.buf.byteLength,
    mime: image.mime,
    ownerId: owner?.id ?? null,
    ownerKind: owner?.kind ?? "USER",
  });

  // The thumbnail is a file on disk like any other, so it gets a row
  // like any other. Without one the orphan sweeper would see an
  // unreferenced file and delete every thumbnail on the server.
  if (relativeThumb && thumbUrl && image.thumb) {
    await recordUpload({
      url: thumbUrl,
      relPath: relativeThumb,
      category: safeCategory,
      bytes: image.thumb.buf.byteLength,
      mime: image.mime,
      ownerId: owner?.id ?? null,
      ownerKind: owner?.kind ?? "USER",
    });
  }

  return {
    ok: true,
    url,
    thumbUrl,
    width: image.full.width,
    height: image.full.height,
  };
}
