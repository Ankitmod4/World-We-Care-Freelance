"use client";

/**
 * The mobile and tablet menu.
 *
 * Replaces the old drawer, which was the desktop sidebar squeezed into
 * 320px — thirteen small rows in a narrow scrolling column, none of
 * them where a thumb naturally lands.
 *
 * What this is instead: a panel that slides in from the left edge and
 * takes the whole screen. Destinations are a three-column grid of
 * tiles, so the whole map of the site is visible at once rather than
 * scrolled through. Search sits at the top because it is the fastest
 * route to anything specific, and the country picker follows it, since
 * choosing a country reframes every list behind it.
 *
 * Three details that matter more than they look:
 *
 *  • Body scroll is locked while open, and the scroll position is put
 *    back on close. Without that, iOS quietly resets the page behind
 *    the sheet to the top.
 *  • The panel is `z-50`, above the tab bar, and the tab bar's own
 *    height is padded for at the foot so the last row is never sitting
 *    under it.
 *  • Every tile is a real link. The menu closes on navigation through
 *    `onClose`, not by intercepting the click, so opening one in a new
 *    tab still behaves.
 *
 * It covers the viewport completely, so there is no backdrop to tap —
 * closing is the X, Escape, or picking somewhere to go.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCountry } from "./country-context";
import { AppearanceToggle } from "./appearance";
import { NavIcon, type NavIconName } from "./nav-icons";
import type { ShellViewer } from "./site-shell";
import { Img } from "@/components/ui/img";
import { useT, useLocale } from "./locale-context";
import { LanguagePicker } from "./language-picker";
import type { TFunction } from "@/lib/i18n-core";

interface Destination {
  /** Looks the label and hint up in `destText`. */
  key: string;
  href: string;
  icon: NavIconName;
  /**
   * The icon's own colour.
   *
   * FIXED HEX, NOT A THEME TOKEN, and deliberately so. These are
   * identity colours — the point is that Live is always red and
   * Gratitude is always pink, so the grid becomes something you learn
   * the shape of rather than read every time. A token would repaint
   * them all whenever someone changes their accent, which is the
   * opposite of what makes a colourful menu useful.
   *
   * Every value is mid-luminance, so it holds up on the light surface
   * AND the dark one without a per-mode palette. That rules out pure
   * yellow, which is why Events is amber — an icon is a 1.7px stroke
   * with nothing behind it, so the colour has to carry on its own.
   */
  tint: string;
}

/*
 * NOTIFICATIONS IS NOT IN THIS LIST, on purpose.
 *
 * The bottom tab bar is on screen at every width this sheet opens at
 * (`lg:hidden` on one, below `lg` on the other), and it already
 * carries Alerts — with a live unread badge, which a row in here
 * cannot show. A second door to the same room, one tap deeper and
 * without the count, is worse than no second door.
 *
 * The header's bell is the desktop equivalent and is `hidden
 * lg:contents`, so nothing is stranded: above lg you get the bell,
 * below lg you get the tab.
 */
const DESTINATIONS: Destination[] = [
  { key: "menu.home",        href: "/",            icon: "home",      tint: "#6366F1" },
  { key: "menu.chatrooms",   href: "/chatrooms",   icon: "chat",      tint: "#0EA5E9" },
  { key: "menu.places",      href: "/places",      icon: "pin",       tint: "#10B981" },
  { key: "menu.events",      href: "/events",      icon: "calendar",  tint: "#E0900B" },
  { key: "menu.campaigns",   href: "/campaigns",   icon: "megaphone", tint: "#F97316" },
  { key: "menu.petitions",   href: "/petitions",   icon: "petition",  tint: "#8B5CF6" },
  { key: "menu.articles",    href: "/articles",    icon: "article",   tint: "#3B82F6" },
  { key: "menu.library",     href: "/library",     icon: "clip",      tint: "#D946EF" },
  // Red because it is red everywhere else on the site — the live
  // badge, the recording pill. A different red here would read as a
  // different thing.
  { key: "menu.live",        href: "/live",        icon: "live",      tint: "#EF4444" },
  { key: "menu.townHeroes",  href: "/town-heroes", icon: "star",      tint: "#F59E0B" },
  { key: "menu.gratitude",   href: "/gratitude",   icon: "heart",     tint: "#EC4899" },
  { key: "menu.journal",     href: "/journal",     icon: "journal",   tint: "#0891B2" },
  { key: "menu.progress",    href: "/progress",    icon: "spark",     tint: "#F59E0B" },
  { key: "menu.saved",       href: "/saved",       icon: "bookmark",  tint: "#14B8A6" },
];

/** Literal calls so the extractor can see them — see header-nav.tsx. */
function destText(t: TFunction): Record<string, string> {
  return {
    "menu.home": t("menu.home", "Home"),
    "menu.home.hint": t("menu.home.hint", "The feed"),
    "menu.chatrooms": t("menu.chatrooms", "Chatrooms"),
    "menu.chatrooms.hint": t("menu.chatrooms.hint", "Talk to people"),
    "menu.places": t("menu.places", "Places"),
    "menu.places.hint": t("menu.places.hint", "Map & directory"),
    "menu.events": t("menu.events", "Events"),
    "menu.events.hint": t("menu.events.hint", "What's on"),
    "menu.campaigns": t("menu.campaigns", "Campaigns"),
    "menu.campaigns.hint": t("menu.campaigns.hint", "Awareness"),
    "menu.petitions": t("menu.petitions", "Petitions"),
    "menu.petitions.hint": t("menu.petitions.hint", "Ask for change"),
    "menu.articles": t("menu.articles", "Articles"),
    "menu.articles.hint": t("menu.articles.hint", "Read"),
    "menu.library": t("menu.library", "Library"),
    "menu.library.hint": t("menu.library.hint", "Clips"),
    "menu.live": t("menu.live", "Live"),
    "menu.live.hint": t("menu.live.hint", "On right now"),
    "menu.townHeroes": t("menu.townHeroes", "Town Heroes"),
    "menu.townHeroes.hint": t("menu.townHeroes.hint", "Local people"),
    "menu.gratitude": t("menu.gratitude", "Gratitude"),
    "menu.gratitude.hint": t("menu.gratitude.hint", "Thank someone"),
    "menu.journal": t("menu.journal", "Journal"),
    "menu.journal.hint": t("menu.journal.hint", "Private"),
    "menu.progress": t("menu.progress", "Progress"),
    "menu.progress.hint": t("menu.progress.hint", "Streaks & badges"),
    "menu.saved": t("menu.saved", "Saved"),
    "menu.saved.hint": t("menu.saved.hint", "Bookmarks"),
  };
}

export function MobileMenu({
  open,
  onClose,
  viewer,
}: {
  open: boolean;
  onClose: () => void;
  viewer: ShellViewer;
}) {
  const t = useT();
  const text = destText(t);
  const { locales } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { countries, countryId, country, setCountryId } = useCountry();
  const [term, setTerm] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);

  // Lock the page behind the sheet, and put it back exactly where it
  // was. `position: fixed` is the only approach iOS respects, and it
  // loses the scroll offset unless you restore it by hand.
  useEffect(() => {
    if (!open) return;
    const y = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, y);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Reset on every open, so it never reappears mid-typed.
  useEffect(() => {
    if (open) {
      setTerm("");
      setCountryOpen(false);
    }
  }, [open]);

  const isActive = useMemo(
    () => (href: string) =>
      href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"),
    [pathname],
  );

  if (!open) return null;

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const q = term.trim();
    onClose();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("menu.ariaLabel", "Menu")}>
      <div className="menu-panel absolute inset-0 flex flex-col overflow-hidden bg-[color:var(--color-surface-muted)]">
        {/* ── who you are ───────────────────────────────── */}
        <div
          className="shrink-0 border-b border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] px-4 pb-3"
          style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
        >
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/profile"
              onClick={onClose}
              className="flex min-w-0 items-center gap-2.5"
            >
              {viewer.avatarUrl ? (
                <Img
                  src={viewer.avatarUrl}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover ring-1 ring-[color:var(--color-border-soft)]"
                  variant="thumb"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--color-surface-muted)] text-[15px] font-semibold text-[color:var(--color-text-muted)]">
                  {viewer.displayName.trim().charAt(0).toUpperCase() || "?"}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold leading-tight">
                  {viewer.displayName}
                </span>
                <span className="block truncate text-[12px] text-[color:var(--color-text-subtle)]">
                  {viewer.email}
                </span>
              </span>
            </Link>

            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close", "Close")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-muted)]"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── the scrolling body ────────────────────────── */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 pt-4">
          <form onSubmit={search}>
            <label className="relative block">
              <span className="sr-only">{t("common.search", "Search")}</span>
              <span
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--color-text-subtle)]"
              >
                <NavIcon name="search" size={18} />
              </span>
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                type="search"
                enterKeyHint="search"
                placeholder={t("menu.searchPlaceholder", "Search places, rooms, events…")}
                className="h-12 w-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] pl-10 pr-3 text-[15px] outline-none focus:border-[color:var(--color-brand)]"
              />
            </label>
          </form>

          {/* ── country ───────────────────────────────── */}
          {countries.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]">
              <button
                type="button"
                onClick={() => setCountryOpen((v) => !v)}
                aria-expanded={countryOpen}
                className="flex min-h-12 w-full items-center justify-between gap-3 px-3.5 text-left"
              >
                <span className="text-[14px]">
                  <span className="text-[color:var(--color-text-muted)]">{t("menu.showing", "Showing")} </span>
                  <span className="font-semibold">
                    {country ? `${country.emojiFlag ?? ""} ${country.name}` : t("menu.everywhereLower", "everywhere")}
                  </span>
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden
                  className={`shrink-0 text-[color:var(--color-text-subtle)] transition-transform duration-200 ${
                    countryOpen ? "rotate-180" : ""
                  }`}
                >
                  <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {countryOpen && (
                <ul className="max-h-56 overflow-y-auto border-t border-[color:var(--color-border-soft)] py-1">
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setCountryId(null);
                        setCountryOpen(false);
                      }}
                      className={`min-h-11 w-full px-3.5 text-left text-[14px] ${
                        countryId === null
                          ? "font-semibold text-[color:var(--color-brand)]"
                          : "text-[color:var(--color-text-muted)]"
                      }`}
                    >
                      {t("menu.everywhere", "Everywhere")}
                    </button>
                  </li>
                  {countries.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setCountryId(c.id);
                          setCountryOpen(false);
                        }}
                        className={`min-h-11 w-full px-3.5 text-left text-[14px] ${
                          countryId === c.id
                            ? "font-semibold text-[color:var(--color-brand)]"
                            : "text-[color:var(--color-text-muted)]"
                        }`}
                      >
                        {c.emojiFlag ? `${c.emojiFlag} ` : ""}
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ── the grid ──────────────────────────────── */}
          <div>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
              {t("menu.allDestinations", "Everywhere you can go")}
            </p>
            <ul className="grid grid-cols-3 gap-2">
              {DESTINATIONS.map((d) => {
                const active = isActive(d.href);
                return (
                  <li key={d.href}>
                    <Link
                      href={d.href}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-[92px] flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 text-center transition-colors duration-200 ${
                        active
                          ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)]/8"
                          : "border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]"
                      }`}
                    >
                      {/* Colour only — no chip, no wash. The tile
                          already has a border and a surface; a second
                          filled shape inside it was one box too many. */}
                      <span style={{ color: d.tint }}>
                        <NavIcon name={d.icon} size={24} />
                      </span>
                      <span
                        className={`text-[12.5px] font-semibold leading-tight ${
                          active ? "text-[color:var(--color-brand)]" : ""
                        }`}
                      >
                        {text[d.key]}
                      </span>
                      <span className="text-[10.5px] leading-tight text-[color:var(--color-text-subtle)]">
                        {text[`${d.key}.hint`]}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ── account ───────────────────────────────── */}
          <div
            className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]"
            style={{ marginBottom: "calc(1rem + var(--bottom-nav-h))" }}
          >
            <Link
              href="/profile"
              onClick={onClose}
              className="flex min-h-12 items-center gap-2.5 px-3.5 text-[14px]"
            >
              <span className="text-[color:var(--color-text-muted)]">
                <NavIcon name="user" size={18} />
              </span>
              {t("menu.yourProfile", "Your profile")}
            </Link>
            <div className="border-t border-[color:var(--color-border-soft)]" />
            <Link
              href="/settings/donations"
              onClick={onClose}
              className="flex min-h-12 items-center gap-2.5 px-3.5 text-[14px]"
            >
              <span className="text-[color:var(--color-text-muted)]">
                <NavIcon name="heart" size={18} />
              </span>
              {t("menu.donations", "Donations")}
            </Link>
            <div className="border-t border-[color:var(--color-border-soft)]" />
            <Link
              href="/settings/payouts"
              onClick={onClose}
              className="flex min-h-12 items-center gap-2.5 px-3.5 text-[14px]"
            >
              <span className="text-[color:var(--color-text-muted)]">
                <NavIcon name="card" size={18} />
              </span>
              {t("menu.gettingPaid", "Getting paid")}
            </Link>
            <div className="border-t border-[color:var(--color-border-soft)]" />
            <Link
              href="/settings"
              onClick={onClose}
              className="flex min-h-12 items-center gap-2.5 px-3.5 text-[14px]"
            >
              <span className="text-[color:var(--color-text-muted)]">
                <NavIcon name="settings" size={18} />
              </span>
              {t("menu.settings", "Settings")}
            </Link>
            <div className="border-t border-[color:var(--color-border-soft)]" />
            {/* Same reasoning as the desktop menu: a nightly action
                belongs where the thumb already is. */}
            <div className="px-3.5 py-3">
              <AppearanceToggle />
            </div>
            {/*
              THE LANGUAGE PICKER LIVES HERE TOO. The header's copy is
              `hidden lg:contents`, which is right for a row that has
              to fit a wordmark, a search box and a bell at 360px — but
              it would leave every phone reader with no way to change
              language at all. The picker hides itself when only one
              language is enabled, so this costs nothing until there is
              something to choose.
            */}
            {locales.length > 1 && (
              <>
                <div className="border-t border-[color:var(--color-border-soft)]" />
                {/*
                  `variant="row"` — the whole row opens it, and the
                  list expands inside this card rather than floating
                  over it. The header's popover shape cannot work
                  here: this card is `overflow-hidden` and the sheet
                  around it scrolls, so an absolute menu was clipped
                  by both and showed as a sliver over "Sign out".
                */}
                <LanguagePicker variant="row" />
              </>
            )}
            <div className="border-t border-[color:var(--color-border-soft)]" />
            <form action="/api/user/auth/logout" method="post">
              <button
                type="submit"
                className="flex min-h-12 w-full items-center px-3.5 text-left text-[14px] font-medium text-[color:var(--color-danger)]"
              >
                {t("menu.signOut", "Sign out")}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
