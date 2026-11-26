/**
 * Thumbnail URL derivation, on its own.
 *
 * Split from `image-variants.ts` because feed components need this and
 * that file imports sharp the moment it is loaded — a native binary has
 * no business anywhere near a browser bundle. Constants and pure
 * functions in here; no imports at all.
 */

export const THUMB_SUFFIX = "-thumb";

/**
 * Formats that never get a thumbnail, because they are never resized.
 * A vector has no pixels to resample; an animated GIF would lose every
 * frame but the first.
 */
const NO_THUMB_EXT = new Set([".svg", ".gif", ".ico", ".avif"]);

/**
 * The thumbnail URL for a stored image.
 *
 * ALWAYS `.webp`, WHATEVER THE SOURCE WAS. The first version of this
 * only derived a thumbnail for images that were already WebP, which
 * meant every JPEG and PNG on the site — which is to say nearly all of
 * them — silently kept serving the full-size original. A rule that
 * only fires for files uploaded after the rule existed is not a
 * feature, it is a no-op with a comment.
 *
 * This is OPTIMISTIC: it returns a URL that may not exist yet, for an
 * image uploaded before the resizer or not yet backfilled. `<Img>`
 * handles that by falling back to the original on error, which is why
 * being optimistic here is safe and being conservative was not.
 */
export function thumbUrlFor(url: string | null | undefined): string | null {
  if (!url || !url.includes("/uploads/")) return null;

  // Strip any query or hash before looking at the extension.
  const cut = url.search(/[?#]/);
  const clean = cut === -1 ? url : url.slice(0, cut);

  const dot = clean.lastIndexOf(".");
  if (dot <= clean.lastIndexOf("/")) return null;

  const ext = clean.slice(dot).toLowerCase();
  if (NO_THUMB_EXT.has(ext)) return null;

  const base = clean.slice(0, dot);
  if (base.endsWith(THUMB_SUFFIX)) return clean;

  return `${base}${THUMB_SUFFIX}.webp`;
}
