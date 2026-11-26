"use client";

/**
 * Tabs, a list, and a Load more button — the shape nine sections share.
 *
 * WHAT VARIES BETWEEN SECTIONS IS THE CARD, and almost nothing else.
 * Articles, campaigns, events, petitions, places, live, town heroes
 * and the two walls all: show a category strip, list what is in the
 * chosen category newest-first, and need a way to see more without the
 * first screen being two hundred rows. Nine copies of that is nine
 * chances for the empty state, the reset-on-tab-switch and the loading
 * skeleton to drift apart, which is exactly what happened to the tile
 * grid this replaces.
 *
 * So the section supplies three things — how to fetch a page, how to
 * draw one item, and what to say when there is nothing — and this owns
 * the rest.
 *
 * FETCHING IS THE SECTION'S JOB, not this component's. Every one of
 * these has a different endpoint with different parameters, and an
 * abstraction over all nine would be a worse version of nine fetch
 * calls. What is shared is WHEN to fetch: on mount, on tab change, and
 * on Load more — and that the list resets when the tab changes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CategoryTabs, type TabCategory } from "./category-tabs";
import { LoadMore, PAGE_SIZE } from "./load-more";
import { useT } from "./locale-context";
import type { ContentKind } from "@/lib/content-kinds";

export interface Page<T> {
  items: T[];
  /** Omit when the section cannot know; then `items.length` decides. */
  hasMore?: boolean;
  /**
   * For the cursor-paged sections — the confession and gratitude
   * walls, which page by "older than this id" rather than by offset.
   *
   * An offset is wrong for a wall: posts arrive while you read, and
   * `skip=12` after three new ones shows you three you have already
   * seen. A cursor pages through the list as it was, which is why
   * those two do it differently and why this has to carry it.
   */
  nextCursor?: string | null;
}

export function CategoryBrowse<T extends { id: string }>({
  categories,
  fetchPage,
  renderItem,
  renderList,
  layout,
  empty,
  header,
  allLabel,
  label,
  pageSize = PAGE_SIZE,
  kind,
}: {
  categories: TabCategory[];
  /** Which category table these came from — see CategoryTabs. */
  kind?: ContentKind;
  /**
   * page is 1-based; cursor is whatever the last page returned, or
   * null on the first. Offset sections ignore the cursor, cursor
   * sections ignore the page. Called on mount, on tab change and on
   * Load more.
   */
  fetchPage: (
    categorySlug: string | null,
    page: number,
    cursor: string | null,
  ) => Promise<Page<T>>;
  /** One card. Ignored when `renderList` is given. */
  renderItem?: (item: T) => React.ReactNode;
  /**
   * The WHOLE list, for sections whose rows depend on their
   * neighbours {D} the calendar puts a date heading above the first
   * event of each day, which cannot be decided one card at a time.
   * Given this, `layout` and `renderItem` are not used.
   */
  renderList?: (items: T[]) => React.ReactNode;
  /** The grid the cards sit in. A wall passes its own column CSS. */
  layout?: string;
  /** Shown when a category has nothing in it. Gets the active slug. */
  empty: (categorySlug: string | null) => React.ReactNode;
  /** Anything between the tabs and the list — a "start one" button. */
  header?: React.ReactNode;
  allLabel?: string;
  label?: string;
  pageSize?: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [items, setItems] = useState<T[] | null>(null);
  const [page, setPage] = useState(1);
  const [cursor, setCursor] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const t = useT();
  const [busy, setBusy] = useState(false);

  // A tab switched twice quickly must not let the FIRST response land
  // last and paint the wrong category's list. Every request carries the
  // slug it was made for, and a stale one is dropped.
  const wanted = useRef<string | null>(null);

  const load = useCallback(
    async (slug: string | null, nextPage: number, from: string | null) => {
      wanted.current = slug;
      setBusy(true);
      // A failed fetch is an empty page, not a crash: the section keeps
      // whatever it already had and the button stays available.
      const res: Page<T> = await fetchPage(slug, nextPage, from).catch(() => ({ items: [] }));
      if (wanted.current !== slug) return;
      setBusy(false);
      setItems((prev) => (nextPage === 1 ? res.items : [...(prev ?? []), ...res.items]));
      // A cursor section that returns no next cursor has reached the
      // end, whatever the page happened to contain.
      setMore(
        res.nextCursor !== undefined
          ? !!res.nextCursor
          : (res.hasMore ?? res.items.length >= pageSize),
      );
      setCursor(res.nextCursor ?? null);
      setPage(nextPage);
    },
    [fetchPage, pageSize],
  );

  useEffect(() => {
    void load(active, 1, null);
  }, [active, load]);

  const onTab = (slug: string | null) => {
    // Blank the list rather than leaving the old category's cards under
    // the newly-selected tab while the fetch is in flight — that reads
    // as "here are the housing ones" when they are not.
    setItems(null);
    setActive(slug);
  };

  return (
    <>
      <CategoryTabs
        kind={kind}
        categories={categories}
        value={active}
        onChange={onTab}
        allLabel={allLabel}
        label={label}
      />

      {header}

      {items === null ? (
        <div className={layout ?? "space-y-3"}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)]"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        empty(active)
      ) : (
        <>
          {renderList ? (
            renderList(items)
          ) : (
            <div className={layout}>{items.map((it) => renderItem?.(it))}</div>
          )}
          {more && (
            <LoadMore
              remaining={null}
              onMore={() => void load(active, page + 1, cursor)}
              label={busy ? t("common.loading", "Loading…") : t("common.loadMore", "Load more")}
            />
          )}
        </>
      )}
    </>
  );
}
