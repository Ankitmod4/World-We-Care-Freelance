"use client";

/**
 * Country picker — a searchable listbox, not a native <select>.
 *
 * WHY REPLACE A PERFECTLY GOOD NATIVE CONTROL. There are 249 options.
 * A native select on a phone is a full-screen wheel you scroll with a
 * thumb, and on a desktop it is a 249-item scrolling column where the
 * only way to find "Netherlands" is to type "n" repeatedly and hope.
 * Type-to-jump matches from the start of the name only, so nobody
 * finds "Republic of Korea" by typing "korea".
 *
 * This one filters as you type, on the name OR the ISO code, and
 * ignores accents — "cote", "Côte" and "CI" all find Côte d'Ivoire.
 *
 * ACCESSIBILITY IS NOT OPTIONAL HERE. A custom dropdown that a screen
 * reader cannot drive is a downgrade from the native control, however
 * much nicer it looks. So: the trigger is a real button that reports
 * its expanded state, the list is a listbox of options, focus stays in
 * the search field while `aria-activedescendant` moves the selection
 * (which is what lets you type and arrow at the same time), and every
 * key a native select answers to is answered here.
 *
 * The trigger carries `name="countryId"` on purpose. The signup form
 * finds the first field with an error by querying `[name="…"]` and
 * focusing it; a hidden input would have that name and not be
 * focusable, so the error would point at nothing.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useT } from "@/components/site/locale-context";

export interface CountryChoice {
  id: string;
  name: string;
  emojiFlag: string | null;
  code?: string | null;
}

/** Lowercase, accents stripped — so "Åland" is reachable by "aland". */
function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function CountrySelect({
  id = "countryId",
  name = "countryId",
  value,
  onChange,
  countries,
  placeholder,
  invalid,
  disabled,
  describedBy,
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (id: string) => void;
  countries: CountryChoice[];
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  describedBy?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = useMemo(
    () => countries.find((c) => c.id === value) ?? null,
    [countries, value],
  );

  /**
   * Matches, best first: a name that STARTS with what was typed beats
   * one that merely contains it. Typing "ind" should offer India
   * before British Indian Ocean Territory.
   */
  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return countries;
    const starts: CountryChoice[] = [];
    const contains: CountryChoice[] = [];
    for (const c of countries) {
      const name = fold(c.name);
      if (name.startsWith(q) || fold(c.code ?? "") === q) starts.push(c);
      else if (name.includes(q)) contains.push(c);
    }
    return [...starts, ...contains];
  }, [countries, query]);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    setQuery("");
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const choose = useCallback(
    (c: CountryChoice) => {
      onChange(c.id);
      close();
    },
    [onChange, close],
  );

  // Opening starts on whatever is already chosen, and puts the caret in
  // the search box so you can just start typing.
  useEffect(() => {
    if (!open) return;
    const i = Math.max(0, countries.findIndex((c) => c.id === value));
    setActive(i);
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, countries, value]);

  // Filtering can leave the highlight past the end of the new list.
  useEffect(() => {
    setActive((i) => (i >= matches.length ? 0 : i));
  }, [matches.length]);

  // Keep the highlighted row on screen — it moves by keyboard, and a
  // selection you cannot see is the same as no selection.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (matches.length === 0) return;
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActive((i) => (i + step + matches.length) % matches.length);
        return;
      }
      case "Home":
        if (open) { e.preventDefault(); setActive(0); }
        return;
      case "End":
        if (open) { e.preventDefault(); setActive(Math.max(0, matches.length - 1)); }
        return;
      case "Enter":
        if (open) {
          e.preventDefault();
          const c = matches[active];
          if (c) choose(c);
        }
        return;
      case "Escape":
        if (open) { e.preventDefault(); close(); }
        return;
      case "Tab":
        // Tabbing away commits nothing and closes — the same as a
        // native select losing focus with the list open.
        if (open) { setOpen(false); setQuery(""); }
        return;
      default:
    }
  };

  const border = invalid
    ? "border-[color:var(--color-danger)] focus-visible:border-[color:var(--color-danger)] focus-visible:ring-[color:var(--color-danger-soft)]"
    : "border-[color:var(--color-border)] focus-visible:border-[color:var(--color-brand)] focus-visible:ring-[color:var(--color-brand-soft)]";

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        name={name}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={`flex h-11 w-full items-center justify-between gap-3 rounded-[12px] border bg-[color:var(--color-surface)] px-3.5 text-left text-[14.5px] transition-shadow duration-150 focus:outline-none focus-visible:ring-4 disabled:opacity-50 ${border}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.emojiFlag && <span aria-hidden>{selected.emojiFlag}</span>}
          <span
            className={`truncate ${selected ? "" : "text-[color:var(--color-text-subtle)]"}`}
          >
            {selected ? selected.name : (placeholder ?? t("auth.countryPlaceholder", "Where are you?"))}
          </span>
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
          className={`shrink-0 text-[color:var(--color-text-subtle)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M5.5 8l4.5 4.5L14.5 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-elevated">
          <div className="border-b border-[color:var(--color-border-soft)] p-2">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t("country.search", "Type to search…")}
              aria-label={t("country.searchAria", "Search countries")}
              aria-controls={listId}
              aria-activedescendant={matches[active] ? `${listId}-${matches[active].id}` : undefined}
              autoComplete="off"
              className="h-9 w-full rounded-[10px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] px-3 text-[14px] focus:border-[color:var(--color-brand)] focus:outline-none"
            />
          </div>

          {matches.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-[color:var(--color-text-subtle)]">
              {/* Two different nothings: nothing typed yet and no list
                  to show, versus a search that found none. */}
              {countries.length === 0
                ? t("country.listFailed", "The country list hasn\u2019t loaded.")
                : `No country matches “${query.trim()}”.`}
            </p>
          ) : (
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={t("common.country", "Country")}
              className="max-h-64 overflow-y-auto p-1.5"
            >
              {matches.map((c, i) => {
                const isSelected = c.id === value;
                const isActive = i === active;
                return (
                  <li
                    key={c.id}
                    id={`${listId}-${c.id}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(c)}
                    className={`flex cursor-pointer items-center gap-2 rounded-[10px] px-3 py-2 text-[14px] ${
                      isActive
                        ? "bg-[color:var(--color-brand-tint)] text-[color:var(--color-text)]"
                        : "text-[color:var(--color-text-muted)]"
                    } ${isSelected ? "font-semibold" : ""}`}
                  >
                    {c.emojiFlag && <span aria-hidden>{c.emojiFlag}</span>}
                    <span className="truncate">{c.name}</span>
                    {isSelected && (
                      <svg
                        width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden
                        className="ml-auto shrink-0 text-[color:var(--color-brand)]"
                      >
                        <path d="M4.5 10.5l3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
