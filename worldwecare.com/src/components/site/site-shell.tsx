"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { SiteHeader } from "./site-header-app";
import { SiteSidebar } from "./site-sidebar";
import { MobileMenu } from "./mobile-menu";
import { BottomNav } from "./bottom-nav";
import { SiteSidebarRight } from "./site-sidebar-right";
import { RailToggle } from "./rail-toggle";
import { CountryContext, type CountryOption } from "./country-context";
import { useLocale } from "./locale-context";
import { countryLabel } from "@/lib/country-name";
import { AppearanceProvider, useAppearanceState } from "./appearance";
import { DEFAULT_APPEARANCE_MODE, type AppearanceMode, DEFAULT_TONE } from "@/lib/theming";

export interface ShellViewer {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  emailVerifiedAt: string | null;
  /** Chosen palette; null = the default. */
  colorThemeId?: string | null;
  /** "system" = follow the OS. Absent = the member never chose. */
  appearanceMode?: AppearanceMode;
  /** How deep the chosen colour runs. 0 lightest … 4 darkest. */
  brandTone?: number;
}

/**
 * Signed-in app shell — one wrapper that gives every page:
 *   • the member's colour theme and light/dark mode
 *   • sticky top header (logo, hamburger, country picker, profile)
 *   • persistent left sidebar on desktop (≥ lg)
 *   • a full-screen menu sheet on mobile/tablet, for everything the
 *     tab bar has no room for
 *   • a five-tab bottom bar below lg — its height lives in the
 *     `--bottom-nav-h` custom property so page padding, the chat
 *     panes and the toasts can all subtract the same number
 *   • CountryContext so any descendant can read the active country
 *
 * Kept as a client component because the drawer, dropdowns, and
 * country selection all involve local state. Page content passed
 * as children is free to be server-rendered on its own.
 */
export function SiteShell({
  viewer,
  children,
  hideRightRail,
  fullBleed,
}: {
  viewer: ShellViewer;
  children: React.ReactNode;
  hideRightRail?: boolean;
  /**
   * The page manages its own height and scrolling — for screens like a
   * chatroom, where the composer belongs at the bottom of the viewport
   * and the messages scroll between it and the header. The shell stops
   * padding the column and stops letting the page scroll; the child
   * gets the space between header and tab bar, and fills it.
   */
  fullBleed?: boolean;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  /**
   * The rail's open/closed state lives on <html data-rail>, not here.
   *
   * The attribute is the source of truth because it is set before
   * paint and CSS reads it; this function just flips it and writes
   * the choice down. Deliberately no React state mirroring it — a
   * second copy would be a second thing to get out of step, and
   * nothing in this component needs to re-render when it changes.
   */
  const toggleRail = useCallback(() => {
    const el = document.documentElement;
    const next = el.dataset.rail === "collapsed" ? "open" : "collapsed";
    if (next === "collapsed") el.dataset.rail = "collapsed";
    else delete el.dataset.rail;
    try {
      localStorage.setItem("wwc-rail", next);
    } catch {
      // Private mode. The rail still collapses for this page view;
      // it just will not be remembered, which is the right way round.
    }
  }, []);

  /*
   * APPEARANCE. Three things happen here and all of them matter.
   *
   * The state lives HERE, not in the picker and not in the DOM. The
   * <style> below is rendered from it, so changing a theme is an
   * ordinary React render — which is the only way it survives. An
   * earlier version wrote to the style element directly and was
   * silently undone by the next re-render, because React 19 compares
   * `dangerouslySetInnerHTML` by object identity and rewrites it every
   * time. See the note at the top of appearance.tsx.
   *
   * It is SEEDED FROM THE SERVER, so the first byte of HTML already
   * carries the right palette. There is no window where the default
   * shows through while JavaScript catches up — the flash that every
   * read-it-from-localStorage-on-mount implementation has.
   *
   * `#app-shell` is the anchor the dark rules hang off, and it only
   * exists here. That is what keeps the marketing pages, the login
   * form and every public profile in the light default even for a
   * member who lives in dark mode: those pages don't mount a shell,
   * so `html:has(#app-shell[data-appearance="dark"])` cannot match.
   *
   * `attribute` is null for "system" — deliberately. The
   * prefers-color-scheme rule matches on the ABSENCE of the
   * attribute, so writing data-appearance="system" would silently
   * disable automatic dark mode for everyone who never chose.
   */
  const appearance = useAppearanceState({
    colorThemeId: viewer.colorThemeId ?? null,
    tone: viewer.brandTone ?? DEFAULT_TONE,
    mode: viewer.appearanceMode ?? DEFAULT_APPEARANCE_MODE,
  });
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countryId, setCountryIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Load the countries once. Cheap public endpoint with SWR
  // caching, so subsequent shells reuse the fetch.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/public/geo/countries");
        const d = (await res.json().catch(() => ({ items: [] }))) as {
          items: CountryOption[];
        };
        if (alive) setCountries(d.items ?? []);
      } catch {
        // no-op; picker will show only "All countries" until it recovers
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Persist the user's country choice locally. We deliberately
  // don't persist on the server yet — nothing else needs it, and
  // treating it as a viewer preference keeps the API surface small.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("wwc:country");
      if (saved) setCountryIdState(saved);
    } catch {
      /* localStorage disabled */
    }
  }, []);

  const setCountryId = useCallback((id: string | null) => {
    setCountryIdState(id);
    try {
      if (id) window.localStorage.setItem("wwc:country", id);
      else window.localStorage.removeItem("wwc:country");
    } catch {
      /* ignore */
    }
  }, []);

  // Close the drawer when navigating (link inside triggers this
  // through the onNavigate prop we hand into the drawer).
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  /*
    COUNTRY NAMES ARE LOCALISED ONCE, HERE, rather than at each of the
    dozen places that print one.

    Every consumer reads its country out of this context — the picker,
    the members page, the feed's "Showing posts from …", the right
    rail, the heroes strip, three "new" forms. Localising at the
    source fixes all of them and cannot drift, which is exactly what
    went wrong with the two copies of `monthYear`.

    `Intl` does it for free: no translator, no cache row, no "Fill
    gaps" step when a language is switched on. The English name stays
    on the row as the fallback.

    The name is only ever displayed — nothing posts it back to the
    server — so replacing it here is safe. `code` is untouched, which
    matters: it is what `SupportCard` now tests against, and what the
    picker's search still accepts.
  */
  const { locale } = useLocale();
  const localised = useMemo(
    () => countries.map((c) => ({ ...c, name: countryLabel(locale, c.code, c.name) })),
    [countries, locale],
  );

  const country = localised.find((c) => c.id === countryId) ?? null;

  return (
    <CountryContext.Provider
      value={{ countries: localised, countryId, country, setCountryId, ready }}
    >
      <AppearanceProvider value={appearance}>
      <style
        id="wwc-theme"
        dangerouslySetInnerHTML={{ __html: appearance.styleBlock }}
      />
      <div
        id="app-shell"
        data-appearance={appearance.attribute ?? undefined}
        className="min-h-screen bg-[color:var(--color-ground)]"
      >
        <SiteHeader
          viewer={viewer}
          onOpenDrawer={() => setDrawerOpen(true)}
        />

        <div className="mx-auto max-w-[1440px] px-3 sm:px-4 lg:px-6 flex gap-6">
          {/*
            Sidebar — sticky on desktop only.

            `scrollbar-none` hides the BAR, not the scrolling: both
            rails still move by wheel, trackpad, touch, keyboard and
            the scrollbar's own drag is simply gone. Two permanent
            grey tracks framing the page is a lot of furniture for
            columns that only overflow on a short window, and the main
            column keeps its own bar so nobody loses their place on
            the page itself.
          */}
          <aside className="scrollbar-none hidden lg:block sticky top-16 self-start w-64 shrink-0 pt-6 pb-10 h-[calc(100vh-4rem)] overflow-y-auto">
            <SiteSidebar viewer={viewer} />
          </aside>

          {/* Main column — the page's content */}
          <main
            className={cn(
              "flex-1 min-w-0",
              fullBleed
                ? // Edge to edge below lg: the column's own padding
                  // would otherwise draw a margin around a screen
                  // meant to fill the phone. `dvh`, not `vh` — with
                  // `vh` a docked composer sits underneath the mobile
                  // browser's address bar.
                  "-mx-3 sm:-mx-4 lg:mx-0 flex flex-col overflow-hidden h-[calc(100dvh-4rem-var(--bottom-nav-h))]"
                : "pt-6 lg:pt-8 pb-[calc(1.5rem+var(--bottom-nav-h))] lg:pb-8",
            )}
          >
            {children}
          </main>

          {/*
            Right rail — context + support, wide screens only, and
            COLLAPSIBLE from xl up.

            `rail-panel` and `rail-tab` are the two halves of the
            toggle and they are BOTH always rendered; globals.css shows
            one or the other from `data-rail` on <html>. Doing it in
            CSS rather than React is what makes the first paint correct
            — see the note in layout.tsx.

            Collapsing does not need to resize anything: `main` is
            `flex-1`, so the moment the rail stops taking 18rem the
            content column takes it instead, and every grid on the site
            is sized to its container rather than to a viewport
            breakpoint, so the walls and tile grids re-flow on their
            own.
          */}
          {!hideRightRail && (
            <>
              <aside
                id="wwc-right-rail"
                data-rail-panel
                className="rail-panel scrollbar-none hidden xl:block sticky top-16 self-start w-72 shrink-0 pt-6 pb-10 h-[calc(100vh-4rem)] overflow-y-auto"
              >
                <div className="mb-2 -mt-1 flex justify-end">
                  <RailToggle open onClick={toggleRail} />
                </div>
                <SiteSidebarRight />
              </aside>

              {/*
                The way back. A collapsed panel with no visible control
                is a feature somebody turns on once and cannot turn
                off, so this sits on the right edge, always reachable,
                and only ever visible while the rail is collapsed.
              */}
              <div
                data-rail-tab
                className="rail-tab fixed right-0 top-28 z-30 hidden xl:block"
              >
                <RailToggle open={false} onClick={toggleRail} />
              </div>
            </>
          )}
        </div>

        <MobileMenu
          open={drawerOpen}
          onClose={closeDrawer}
          viewer={viewer}
        />

        <BottomNav viewer={viewer} />
      </div>
      </AppearanceProvider>
    </CountryContext.Provider>
  );
}
