"use client";

/**
 * The category strip: tabs on a desktop, a dropdown on a phone.
 *
 * ONE COMPONENT, NINE SECTIONS. Articles, campaigns, confessions,
 * events, gratitude, live, petitions, places and town heroes all ask
 * the same question — which of these do you want — and all nine used
 * to answer it with a grid of tiles. The tiles were a front door: a
 * whole screen of them before any content, and a page load to get past
 * them. A strip answers the same question in one row and leaves the
 * rest of the screen for the thing the reader came for.
 *
 * ONE ROW, NEVER TWO. `overflow-x-auto` with `shrink-0` children,
 * rather than `flex-wrap` — a strip that wraps to three lines is a tile
 * grid again, just uglier.
 *
 * SO IT HAS ARROWS. A row that scrolls sideways with the scrollbar
 * hidden is a row most people cannot scroll: there is no wheel gesture
 * for horizontal on a mouse, and nothing on screen says the row
 * continues. The arrows appear only when there is something past the
 * edge, and each one also fades the pills beneath it so the cut looks
 * deliberate rather than clipped.
 *
 * They are `aria-hidden` and untabbable on purpose. A keyboard user
 * tabs through the pills themselves and the browser scrolls each one
 * into view, so the arrows would be two extra stops that do nothing
 * new. They exist for the pointer.
 *
 * A CUSTOM DROPDOWN ON A PHONE, not a native <select>. The native one
 * cannot show the emoji and the count in the way the tabs do — several
 * platforms render the option text in a sheet that strips the
 * alignment — and it cannot show which option is selected as anything
 * other than the closed label. This one is a listbox: it matches the
 * tabs, it keeps the counts legible, and it still closes on Escape, on
 * a click outside, and on a choice.
 *
 * THE HEADING IS PART OF THIS COMPONENT, not something each page
 * prints above it. Only /articles had one, so on the other eight the
 * strip appeared with nothing saying what it was — a row of pills
 * under a banner reads as filters somebody has already applied rather
 * than as a set of choices. Putting it here means one wording, one
 * position, and one place to change it.
 *
 * It sits above BOTH controls, so the phone gets it too: the dropdown
 * needs it more, not less, since a closed dropdown showing "All" says
 * even less about itself than a row of pills does.
 *
 * "ALL" IS A REAL TAB HERE, unlike the "Everything" chip the walls had
 * removed. That chip sat *beside* a tile grid, where its only job was
 * to undo the control next to it. In a strip the absence of a filter
 * is one of the choices, and leaving it out would mean no way back to
 * the unfiltered list without a page reload.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useT } from "./locale-context";
import { TranslatedContent } from "./translated-content";
import type { ContentKind } from "@/lib/content-kinds";

export interface TabCategory {
  id: string;
  name: string;
  slug: string;
  emoji?: string | null;
  /** Shown after the name when present — "12", "3 live". */
  count?: number | null;
}

/**
 * One category's name, in the reader's language.
 *
 * A component rather than a call inside the map, because the
 * translation arrives asynchronously and hooks cannot be called in a
 * loop whose length changes when a page loads its categories.
 *
 * No "Show original" here: the strip is navigation, every tab is two
 * or three words, and a link under each one would double the height
 * of the row to undo something nobody asked for.
 */
function CategoryName({
  kind,
  category,
}: {
  kind?: ContentKind;
  category: TabCategory;
}) {
  if (!kind) return <>{category.name}</>;
  return (
    <TranslatedContent
      kind={kind}
      id={category.id}
      field="name"
      text={category.name}
      toggle={false}
    />
  );
}

export function CategoryTabs({
  categories,
  value,
  onChange,
  allLabel,
  label,
  heading,
  kind,
}: {
  categories: TabCategory[];
  /** The active category slug, or null for "All". */
  value: string | null;
  onChange: (slug: string | null) => void;
  allLabel?: string;
  /** For the listbox's accessible name, and the tablist's. */
  label?: string;
  /**
   * The line above the strip. "Section" is right for eight of the
   * nine; places browse by KIND of place, and says so. Pass null to
   * drop it where the surrounding page already names the thing.
   */
  heading?: string | null;
  /*
     Which table these categories come from, so their NAMES can be
     translated too.

     An English tab strip over a translated page is the most visible
     thing on the screen, and it is the same nine tables everywhere —
     so it is wired once, here, rather than at each of the ten
     listing pages. Omitted where the "categories" are not rows at all:
     the places directory builds its strip out of an enum of place
     kinds, whose labels are ordinary interface strings and already go
     through `t()`.
  */
  kind?: ContentKind;
}) {
  /*
     THE DEFAULTS LIVE HERE, NOT IN THE PARAMETER LIST.

     `allLabel = "All"` is evaluated where this function is defined,
     which is nowhere a hook can run — so the English default shipped
     as English on every page in every language, and the extractor
     never saw it either. `undefined` now means "use the translated
     default"; `null` for the heading still means "no heading", which
     is the one call site that needs it.
  */
  const t = useT();
  const allText = allLabel ?? t("common.all", "All");
  const labelText = label ?? t("common.categories", "Categories");
  const headingText = heading ?? t("common.browseBySection", "Browse by section");
  const stripRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const measure = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    // 1px of slack: sub-pixel widths make an un-scrolled row report a
    // scrollLeft of 0.4 and a right edge half a pixel short, which
    // would flicker both arrows on at rest.
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  // Layout effect, not effect: the arrows are part of the first paint,
  // and deciding whether to show them one frame later is a visible jump.
  useLayoutEffect(() => {
    measure();
    const el = stripRef.current;
    if (!el) return;
    // Categories arriving, the window resizing, a rail collapsing — all
    // change whether this row overflows, and none of them is a scroll.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [measure, categories.length]);

  // A deep link can land on a tab that is off the right-hand edge.
  // Without this it reads as "nothing is selected".
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    measure();
  }, [value, measure]);

  const nudge = (dir: -1 | 1) => {
    const el = stripRef.current;
    if (!el) return;
    // Most of a screenful, not all of it: a pill left over from the
    // previous view is what tells you the two views are the same row.
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  if (categories.length === 0) return null;

  const pill =
    "relative flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors";
  const on =
    "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]";
  const off =
    "border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border)]";

  return (
    <>
      {heading !== null && (
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
          {headingText}
        </h2>
      )}

      <div className="mb-4 sm:hidden">
        <CategoryDropdown
          categories={categories}
          value={value}
          onChange={onChange}
          allLabel={allText}
          label={labelText}
          kind={kind}
        />
      </div>

      <div className="relative mb-4 hidden sm:block">
        <div
          ref={stripRef}
          role="tablist"
          aria-label={labelText}
          onScroll={measure}
          className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none"
        >
          <button
            type="button"
            role="tab"
            aria-selected={value === null}
            onClick={() => onChange(null)}
            className={`${pill} ${value === null ? on : off}`}
          >
            {allText}
          </button>
          {categories.map((c) => {
            const active = value === c.slug;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChange(c.slug)}
                className={`${pill} ${active ? on : off}`}
              >
                {c.emoji && <span aria-hidden>{c.emoji}</span>}
                <CategoryName kind={kind} category={c} />
                {typeof c.count === "number" && (
                  <span
                    className={
                      "tabular-nums " +
                      (active
                        ? "text-[color:var(--color-on-brand)]/70"
                        : "text-[color:var(--color-text-subtle)]")
                    }
                  >
                    {c.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {!atStart && <ScrollArrow side="left" onClick={() => nudge(-1)} />}
        {!atEnd && <ScrollArrow side="right" onClick={() => nudge(1)} />}
      </div>
    </>
  );
}

/**
 * One end of the strip: a fade, and a button sitting in it.
 *
 * The fade is a sibling of the pills rather than a mask on the row,
 * because a mask would also fade the button. It is pointer-transparent
 * so the pill underneath is still clickable right up to the arrow.
 */
function ScrollArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const isLeft = side === "left";
  return (
    <>
      <span
        aria-hidden
        className={`pointer-events-none absolute top-0 bottom-1 w-16 ${
          isLeft
            ? "left-0 bg-gradient-to-r"
            : "right-0 bg-gradient-to-l"
        } from-[color:var(--color-ground)] to-transparent`}
      />
      <button
        type="button"
        onClick={onClick}
        aria-hidden
        tabIndex={-1}
        className={`absolute top-0 flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] shadow-card transition-colors hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)] ${
          isLeft ? "left-0" : "right-0"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path
            d={isLeft ? "M12 4l-6 6 6 6" : "M8 4l6 6-6 6"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </>
  );
}

/**
 * The phone control: a listbox, not a <select>.
 *
 * Closes on Escape, on a pointer down outside it, and on a choice.
 * Arrow keys move the highlight and Enter takes it, which is the
 * behaviour a native select has and the thing most hand-rolled
 * dropdowns forget.
 */
function CategoryDropdown({
  categories,
  value,
  onChange,
  allLabel,
  label,
  kind,
}: {
  categories: TabCategory[];
  value: string | null;
  onChange: (slug: string | null) => void;
  allLabel: string;
  label: string;
  kind?: ContentKind;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // null first, so the indexes line up with a list that starts at All.
  const options: Array<TabCategory | null> = [null, ...categories];
  const selectedIndex = options.findIndex((o) => (o?.slug ?? null) === value);
  const current = options[selectedIndex] ?? null;

  useEffect(() => {
    if (!open) return;
    setCursor(Math.max(0, selectedIndex));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    // `pointerdown`, not `click`: a click listener fires after the
    // button's own handler has already toggled it back open.
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, selectedIndex]);

  const pick = (i: number) => {
    onChange(options[i]?.slug ?? null);
    setOpen(false);
  };

  const rowLabel = (o: TabCategory | null) =>
    o ? <CategoryName kind={kind} category={o} /> : allLabel;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-left text-[14px] outline-none focus-visible:border-[color:var(--color-brand)]"
      >
        <span className="flex min-w-0 items-center gap-2">
          {current?.emoji && <span aria-hidden>{current.emoji}</span>}
          <span className="truncate font-medium">{rowLabel(current)}</span>
          {typeof current?.count === "number" && (
            <span className="tabular-nums text-[color:var(--color-text-subtle)]">
              {current.count}
            </span>
          )}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
          className={`shrink-0 text-[color:var(--color-text-subtle)] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((i) => Math.min(options.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              pick(cursor);
            }
          }}
          ref={(el) => el?.focus()}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-[60vh] overflow-y-auto rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-1 shadow-elevated outline-none"
        >
          {options.map((o, i) => {
            const selected = (o?.slug ?? null) === value;
            return (
              <li key={o?.id ?? "__all"}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => pick(i)}
                  onPointerMove={() => setCursor(i)}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[14px] transition-colors ${
                    cursor === i ? "bg-[color:var(--color-surface-muted)]" : ""
                  } ${selected ? "font-semibold text-[color:var(--color-brand)]" : ""}`}
                >
                  {o?.emoji && <span aria-hidden>{o.emoji}</span>}
                  <span className="min-w-0 flex-1 truncate">{rowLabel(o)}</span>
                  {typeof o?.count === "number" && (
                    <span className="tabular-nums text-[12px] text-[color:var(--color-text-subtle)]">
                      {o.count}
                    </span>
                  )}
                  {selected && (
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0">
                      <path d="M4 10.5l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
