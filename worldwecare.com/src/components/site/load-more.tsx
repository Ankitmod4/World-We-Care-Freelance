"use client";

/**
 * "Load more", and the counting that goes with it.
 *
 * EVERY CATEGORY-BEARING LIST STARTS AT 12. Before this, most of these
 * pages fetched and drew everything they had: fine with nine articles,
 * a very long page with two hundred. Twelve is three rows of four in a
 * wide column, four rows of three in a narrow one, and six rows of two
 * on a phone — enough to show the shape of a section without being the
 * whole of it.
 *
 * A BUTTON, NOT INFINITE SCROLL. A list that grows as you approach the
 * bottom has no bottom, which means anything under it — the footer, the
 * next section, the "start one" prompt — can never be reached on a
 * phone. The button also makes the size of what is left legible:
 * "Load more (37 left)" is a fact about the list, and a reader deciding
 * whether to keep going deserves it.
 */

import { useCallback, useMemo, useState } from "react";
import { useT } from "./locale-context";

export const PAGE_SIZE = 12;

/**
 * Reveal a list a page at a time.
 *
 * `key` resets the count back to one page: switching category is a new
 * list, and carrying "showing 48" across to it would dump 48 rows of
 * something the reader has not asked to see that much of yet.
 */
export function usePaged<T>(items: T[], key: string | null = null, size = PAGE_SIZE) {
  const [pages, setPages] = useState(1);
  const [lastKey, setLastKey] = useState(key);

  // Derived during render rather than in an effect: an effect would
  // paint one frame of the old page count against the new list.
  if (key !== lastKey) {
    setLastKey(key);
    setPages(1);
  }

  const shown = useMemo(() => items.slice(0, pages * size), [items, pages, size]);
  const more = useCallback(() => setPages((p) => p + 1), []);
  return { shown, more, remaining: Math.max(0, items.length - shown.length) };
}

export function LoadMore({
  remaining,
  onMore,
  label,
}: {
  /**
   * How many are left, when that is knowable.
   *
   * `null` means "there is more, but the server has not said how
   * much" — which is the honest state for a cursor-paged list. The
   * count is then simply absent rather than guessed at, because
   * "37 left" that turns out to be 300 is worse than no number.
   */
  remaining: number | null;
  onMore: () => void;
  /**
   * Left undefined on purpose rather than defaulted to "Load more".
   *
   * A default parameter is evaluated where the component is DEFINED,
   * which is outside any component that could call `useT` — so an
   * English default here is an English button on a Russian page, and
   * the scanner cannot see it either. The fallback moves inside.
   */
  label?: string;
}) {
  const t = useT();
  if (remaining !== null && remaining <= 0) return null;
  return (
    <div className="mt-5 flex justify-center">
      <button
        type="button"
        onClick={onMore}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 text-[13.5px] font-medium transition-colors hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)]"
      >
        {label ?? t("common.loadMore", "Load more")}
        {remaining !== null && (
          <span className="tabular-nums text-[color:var(--color-text-subtle)]">
            {remaining} left
          </span>
        )}
      </button>
    </div>
  );
}
