/**
 * The shape of a clip as every reader-side surface sees it, and the
 * one place its URL is built.
 *
 * It used to live in `clip-modal.tsx`, which meant the card imported a
 * type from the dialog it opened. The dialog is gone — a clip is a
 * page now — so the shape lives on its own, sharable by the grid, the
 * card, the saved list and the page itself.
 */

export interface ClipView {
  id: string;
  title: string;
  caption: string | null;
  kind: "EMBED" | "UPLOAD";
  embedUrl: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  likeCount: number;
  saveCount: number;
  commentCount: number;
  liked: boolean;
  /** Which reaction the viewer left, or null. */
  myReaction: import("./reactions").ReactionType | null;
  saved: boolean;
  /**
   * Always present on the reader side — every query that produces a
   * ClipView joins it, because without the theme slug a clip has no
   * address.
   */
  theme?: { slug: string; name: string; emoji: string | null } | null;
}

/**
 * A clip lives under the theme that holds it: /library/<theme>/<id>.
 *
 * Nested rather than a flat /clips/<id> so the URL says where the clip
 * belongs, and so no theme slug can ever collide with a reserved
 * segment under /library.
 *
 * Returns null rather than a broken link if the theme is missing —
 * that should not happen, and a tile that quietly stops being
 * clickable is better than one that navigates to a 404.
 */
export function clipHref(clip: {
  id: string;
  theme?: { slug: string } | null;
}): string | null {
  if (!clip.theme?.slug) return null;
  return `/library/${encodeURIComponent(clip.theme.slug)}/${encodeURIComponent(clip.id)}`;
}
