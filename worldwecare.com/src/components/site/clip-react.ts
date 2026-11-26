/**
 * The optimistic side of a clip reaction.
 *
 * Three clip surfaces render the same card — the grid, the detail
 * page's related tiles, and the saved list — and each keeps its own
 * copy of the list. This is the one place that knows what a reaction
 * does to a row, so a swap can't increment the count on one screen and
 * leave it alone on another. See src/lib/reaction-toggle.ts for the
 * server-side twin.
 */

import type { ClipView } from "@/lib/clip-view";
import type { ReactionType } from "@/lib/reactions";

export function applyClipReaction(clip: ClipView, type: ReactionType): ClipView {
  const had = clip.myReaction;
  const removing = had === type;
  return {
    ...clip,
    myReaction: removing ? null : type,
    liked: !removing,
    likeCount: removing
      ? Math.max(0, clip.likeCount - 1)
      : had
        ? clip.likeCount
        : clip.likeCount + 1,
  };
}
