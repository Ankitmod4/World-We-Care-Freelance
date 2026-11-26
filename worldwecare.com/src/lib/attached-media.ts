/**
 * Media attached to something a member wrote — the rules, once.
 *
 * Posts had all of this privately, and petitions now need the same
 * three things: clamp an image list, turn a video asset id into
 * something safe to persist, and read the ids back out when the parent
 * is deleted. Copying a security check is how one copy gets fixed and
 * the other does not, so it lives here and both import it.
 */

import { prisma } from "./db";

export interface AttachedImage {
  url: string;
  alt: string | null;
}

export interface AttachedVideo {
  assetId: string;
  url: string;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
}

/**
 * Clamp and normalise a client-supplied image list.
 *
 * Never trust the count or the shape. Only the two fields we actually
 * persist survive, so a client sending forty images with extra keys
 * stores `max` of them with `url` and `alt` and nothing else.
 */
/**
 * How many photos a gallery holds, everywhere it is used.
 *
 * One number so the four surfaces that have a gallery cannot each
 * pick their own — which is how it already went once: petitions cap
 * at 10 through `MAX_PHOTOS` and events at 12 through a literal
 * inlined in `normaliseEvent`, for no reason anybody wrote down.
 * Campaigns and places use this; petitions re-export it; events keep
 * their 12 until somebody decides to move them, and that divergence
 * is now at least visible from here.
 */
export const MAX_GALLERY_PHOTOS = 10;

/**
 * Read a stored `photos` column into the shape PhotoGallery renders.
 *
 * These are JSON columns, so the database hands back whatever was
 * written — including from an older shape, or from a row an admin
 * edited by hand. Everything without a usable url is dropped rather
 * than rendered as a broken frame.
 *
 * `alt` is OMITTED rather than null when there is none, because
 * `GalleryImage.alt` is optional and `alt: null` is not assignable to
 * it. That mismatch is the reason each page was about to grow its own
 * little mapping function.
 */
export function readGallery(raw: unknown): Array<{ url: string; alt?: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((p) => {
    const url = (p as { url?: unknown })?.url;
    if (typeof url !== "string" || !url) return [];
    const alt = (p as { alt?: unknown })?.alt;
    return [typeof alt === "string" && alt ? { url, alt } : { url }];
  });
}

export function sanitiseImages(
  raw: Array<{ url?: unknown; alt?: unknown }> | null | undefined,
  max: number,
): AttachedImage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i) => typeof i?.url === "string" && i.url.length > 0)
    .slice(0, max)
    .map((i) => ({
      url: i.url as string,
      alt: typeof i.alt === "string" ? i.alt : null,
    }));
}

/**
 * Turn a client-supplied asset id into the video we persist.
 *
 * SECURITY: THE CLIENT SENDS AN ID, NEVER A URL. Accepting a URL would
 * let anyone attach any file on the server — or any remote URL — to
 * their own petition or post. The asset must exist, must belong to the
 * person attaching it, and must have finished converting; anything
 * else is refused loudly rather than saving something with a player
 * that never loads.
 */
export async function resolveAttachedVideo(
  assetId: string | null | undefined,
  ownerId: string,
): Promise<AttachedVideo | null> {
  const id = assetId?.trim();
  if (!id) return null;

  const asset = await prisma.videoAsset.findUnique({ where: { id } });
  if (!asset) throw new Error("That video upload could not be found.");
  if (asset.ownerId !== ownerId) throw new Error("That video belongs to someone else.");
  if (asset.status !== "READY" || !asset.url) {
    throw new Error("That video is still processing — wait for it to finish.");
  }

  return {
    assetId: asset.id,
    url: asset.url,
    posterUrl: asset.posterUrl,
    width: asset.width,
    height: asset.height,
    durationSec: asset.durationSec,
  };
}

/**
 * Read a stored `video` JSON column back into an AttachedVideo.
 *
 * The mirror of what `resolveAttachedVideo` wrote, and it trusts the
 * column no more than that function trusts the client: this is JSON,
 * so the database hands back whatever was written — an older shape, a
 * row an admin edited by hand, `{}`. Without `assetId` and `url` there
 * is no video to render, and a half-populated object becomes null
 * rather than a player pointed at `undefined`.
 *
 * Lived privately in petitions.ts until confessions and the gratitude
 * wall needed it. Four copies of "read this column defensively" is
 * four places for one of them to be less defensive than the others.
 */
export function readVideo(raw: unknown): AttachedVideo | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.assetId !== "string" || !v.assetId) return null;
  if (typeof v.url !== "string" || !v.url) return null;
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
  return {
    assetId: v.assetId,
    url: v.url,
    posterUrl: typeof v.posterUrl === "string" && v.posterUrl ? v.posterUrl : null,
    width: num(v.width),
    height: num(v.height),
    durationSec: num(v.durationSec),
  };
}

/** The `url` of each entry in an images/photos JSON column, defensively. */
export function attachedImageUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((i) => {
    const url = (i as { url?: unknown })?.url;
    return typeof url === "string" && url ? [url] : [];
  });
}

/** The `assetId` out of a video JSON column, defensively. */
export function attachedAssetId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const id = (raw as { assetId?: unknown }).assetId;
  return typeof id === "string" && id ? id : null;
}
