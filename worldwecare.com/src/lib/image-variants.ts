/**
 * Image processing at upload time.
 *
 * WHY HERE AND NOT `next/image`. Optimising on the way in means nginx
 * serves plain static files on the way out — nothing in the request
 * path, no optimiser cache to warm or lose on deploy, and no
 * dependence on Next's `public/` file list, which is built once at boot
 * and is exactly what made freshly uploaded images 404 until a restart.
 *
 * Every raster image gets two files:
 *
 *   full   — max 1600px on the long edge, WebP. What a lightbox shows.
 *   thumb  — max 480px on the long edge, WebP. What a feed shows, and
 *            what most views actually load.
 *
 * ── HOW SHARP IS USED, AND WHY ────────────────────────────────────
 *
 * ONE DECODE, TWO CLONES. `sharp(buf)` builds a pipeline; calling it
 * three times decodes the source three times. `.clone()` branches a
 * single decode into both outputs. Worth about 10% on a 12MP photo —
 * modest, but there is no reason to pay it.
 *
 * `failOn: "none"`. Sharp's default aborts on a warning, so a slightly
 * truncated JPEG — which every browser renders without complaint —
 * would throw, and the catch below would store the untouched original.
 * The failure mode of being strict here is silently keeping the big
 * file, which is the exact thing this module exists to prevent.
 *
 * `limitInputPixels`, in two parts. A 100 KB PNG can declare
 * 12000×12000 and expand to gigabytes of RGB on decode. The dimensions
 * are read FIRST, from a header-only probe — `metadata()` parses the
 * header without decoding a single pixel, so it is safe to run with no
 * limit — and an oversized image is refused with our own message. The
 * limit on the real pipeline is then a backstop, not the mechanism.
 *
 * Doing it the other way round is a trap worth spelling out: sharp
 * raises the pixel limit as an ordinary exception from `metadata()`,
 * which lands in the same catch as "this file is not an image", whose
 * job is to store the original untouched. The bomb would sail through
 * as a passthrough and sit on disk — which is precisely what the first
 * version of this file did.
 *
 * `sequentialRead`. Streams the source instead of holding the whole
 * decoded image, which matters when several uploads land at once.
 *
 * `sharp.cache(false)`. libvips keeps decoded operations in a memory
 * cache that pays off for repeated work on the same file. A web server
 * processing a different image every time gets no benefit and holds
 * the memory anyway.
 *
 * ── TWO THINGS THAT ARE NOT ABOUT SPEED ───────────────────────────
 *   • `.rotate()` before resizing. Phone photos carry their
 *     orientation in EXIF; strip the metadata without applying it
 *     first and every portrait photo comes out sideways.
 *   • Metadata is stripped, which removes the GPS coordinates phones
 *     write into photographs. People post pictures from their homes
 *     and from meetings they attend. That is worth more than the bytes.
 */

import sharp from "sharp";

// Re-exported so server callers have one import, while feed components
// take them from the sharp-free module and never pull a native binary
// into the browser bundle.
export { THUMB_SUFFIX, thumbUrlFor } from "./image-urls";

export const FULL_MAX_EDGE = 1600;
export const THUMB_MAX_EDGE = 480;

/** ~50 megapixels. A 100MP phone camera does not exist; a zip bomb does. */
export const MAX_INPUT_PIXELS = 50_000_000;

// Server-wide, set once. See the header.
sharp.cache(false);

/** Formats we deliberately do not touch. */
const PASS_THROUGH = new Set([
  "image/svg+xml",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

export function isPassThrough(mime: string): boolean {
  return PASS_THROUGH.has(mime);
}

const OPEN = {
  failOn: "none" as const,
  limitInputPixels: MAX_INPUT_PIXELS,
  sequentialRead: true,
};

export interface Variant {
  buf: Buffer;
  width: number | null;
  height: number | null;
}

export interface ProcessedImage {
  /** True when the source was re-encoded; false when passed through. */
  processed: boolean;
  mime: string;
  ext: string;
  full: Variant;
  /** Absent for pass-through formats, and for images already smaller
   *  than the thumbnail size — a second copy of the same pixels is
   *  just another file to keep track of. */
  thumb: Variant | null;
  /** Set when the image was refused rather than merely un-processed. */
  refused?: string;
}

/**
 * Turn an uploaded buffer into the variants that get written to disk.
 *
 * Never throws. A corrupt or unreadable image falls back to storing
 * exactly what was uploaded — refusing the upload because the resizer
 * choked would be a worse outcome than serving one big file. The one
 * exception is a decompression bomb, which is reported so the caller
 * can reject it outright.
 */
export async function processImage(
  buf: Buffer,
  mime: string,
): Promise<ProcessedImage> {
  const passthrough = (refused?: string): ProcessedImage => ({
    processed: false,
    mime,
    ext: extFor(mime),
    full: { buf, width: null, height: null },
    thumb: null,
    ...(refused ? { refused } : {}),
  });

  if (isPassThrough(mime)) return passthrough();

  // Step one: how big does this file CLAIM to be? Header only — no
  // pixels are decoded, so an absurd declaration costs nothing to read.
  let declared: { width: number; height: number } | null = null;
  try {
    const probe = await sharp(buf, { failOn: "none", limitInputPixels: false }).metadata();
    if (probe.width && probe.height) {
      declared = { width: probe.width, height: probe.height };
    }
  } catch {
    // Not readable as an image at all. Fall through — the pipeline
    // below will fail the same way and store the original.
  }

  if (declared && declared.width * declared.height > MAX_INPUT_PIXELS) {
    return passthrough(
      `That image is ${Math.round((declared.width * declared.height) / 1e6)} megapixels — ` +
        `too large to process. The limit is ${MAX_INPUT_PIXELS / 1e6}.`,
    );
  }

  try {
    // One pipeline. `.rotate()` with no argument means "apply the EXIF
    // orientation", and it has to sit before any resize.
    const base = sharp(buf, OPEN).rotate();

    const meta = await base.metadata();
    const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (!longEdge) return passthrough();

    const resize = (edge: number, quality: number) =>
      base
        .clone()
        .resize({
          width: edge,
          height: edge,
          fit: "inside",
          // Never upscale. Enlarging a small image adds bytes and
          // removes nothing.
          withoutEnlargement: true,
        })
        .webp({ quality })
        .toBuffer({ resolveWithObject: true });

    // Below the thumbnail size the "thumbnail" would be the same
    // picture at the same dimensions.
    const wantThumb = longEdge > THUMB_MAX_EDGE;

    const [full, thumb] = await Promise.all([
      resize(FULL_MAX_EDGE, 82),
      wantThumb ? resize(THUMB_MAX_EDGE, 72) : Promise.resolve(null),
    ]);

    return {
      processed: true,
      mime: "image/webp",
      ext: ".webp",
      full: { buf: full.data, width: full.info.width, height: full.info.height },
      thumb: thumb
        ? { buf: thumb.data, width: thumb.info.width, height: thumb.info.height }
        : null,
    };
  } catch {
    // Unreadable, truncated past saving, or a format sharp was not
    // built with.
    return passthrough();
  }
}

function extFor(mime: string): string {
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
    default:
      return "";
  }
}
