"use client";

/**
 * The events calendar.
 *
 * Filters by the header's country picker, the same way the feed does,
 * so "local" means the country the reader chose rather than wherever
 * their browser thinks they are.
 *
 * Laid out as an agenda rather than a grid of cards: one full-width row
 * per event, with a date chip on the left that's shown only when the
 * day changes. The old version grouped by day and gave each group its
 * own two-column grid, so any day with a single event left a dangling
 * empty column — a calendar full of holes.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CategoryTabs } from "./category-tabs";
import { LoadMore } from "./load-more";
import { SiteShell, type ShellViewer } from "./site-shell";
import { useCountry } from "./country-context";
import { Button } from "@/components/ui/button";
import { eventDateParts } from "@/lib/timezone";
import { Img } from "@/components/ui/img";
import { PageHeading } from "./page-heading";
import { useT } from "./locale-context";
import type { TFunction } from "@/lib/i18n-core";
import { TranslatedContent } from "./translated-content";

export interface EventCard {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  isOnline: boolean;
  venueName: string | null;
  city: string | null;
  capacity: number | null;
  rsvpCount: number;
}

interface Row extends EventCard {
  parts: ReturnType<typeof eventDateParts>;
  /** First event of its calendar day — the only row that shows the chip. */
  startsDay: boolean;
  relative: string | null;
}

function relativeLabel(
  t: TFunction,
  dayKey: string,
  todayKey: string,
  tomorrowKey: string,
): string | null {
  if (dayKey === todayKey) return t("events.today", "Today");
  if (dayKey === tomorrowKey) return t("events.tomorrow", "Tomorrow");
  return null;
}

interface CategoryChip {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  upcomingCount: number;
}

/**
 * /events — the sections, not the list.
 *
 * This replaced a chip row over a chronological list. The chips were
 * the wrong shape for the job: they were small, they scrolled off the
 * side of a phone, and the empty ones — which are the ones that tell a
 * newcomer what belongs here — read as disabled buttons rather than
 * invitations. Tiles give each category its icon, its colour and a
 * sentence, which is what makes a quiet calendar legible instead of
 * embarrassing.
 *
 * Same component shape as /live, deliberately.
 *
 * THE STRIP'S "All" TAB IS WHAT THE "Everything" TILE USED TO BE, and
 * the calendar needs it for the reason that tile existed: a
 * calendar's first question is "what is next" regardless of kind, and
 * without it there is no route to that answer at all.
 */
export function EventsDirectory({
  viewer,
}: {
  viewer: ShellViewer;
}) {
  const t = useT();
  const { countryId, country } = useCountry();
  const [categories, setCategories] = useState<CategoryChip[] | null>(null);
  // null is "All", which is what the Everything tile used to link to.
  const [active, setActive] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (countryId) params.set("countryId", countryId);
    const res = await fetch(`/api/public/event-categories?${params}`, { cache: "no-store" }).catch(
      () => null,
    );
    if (!res?.ok) {
      setCategories([]);
      return;
    }
    const d = (await res.json().catch(() => ({}))) as { categories?: CategoryChip[] };
    setCategories(d.categories ?? []);
  }, [countryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = (categories ?? []).reduce((n, c) => n + c.upcomingCount, 0);

  return (
    <SiteShell viewer={viewer}>
      {/* `note` carries the live count rather than splicing it into the
          intro: the intro is editable now, and a number injected into a
          sentence an admin has rewritten would read as nonsense. */}
      <PageHeading
        title={t("page.eventsTitle", "Events")}
        intro={t("page.eventsIntro", "Real gatherings{country} — meetups, hikes, coffee, volunteering. Pick a section, or see everything.")}
        country={country?.name}
        actions={
          <Link href="/events/new">
              <Button size="sm">{t("events.submit", "Submit an event")}</Button>
            </Link>
        }
        note={total > 0 ? t("events.comingUp", "{n} coming up.", { n: total }) : null}
      />

      {categories === null ? (
        <div className="mb-4 h-9 w-full animate-pulse rounded-full bg-[color:var(--color-surface-muted)]" />
      ) : categories.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center shadow-card">
          <p className="text-[15px] font-medium">{t("events.noSections", "No sections yet")}</p>
          <p className="mx-auto mt-1 max-w-[46ch] text-[13.5px] text-[color:var(--color-text-muted)]">
            {t("events.noSectionsBlurb", "An admin needs to set these up before anyone can post an event.")}
          </p>
        </div>
      ) : (
        <>
          <CategoryTabs
            kind="eventCategory"
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              emoji: c.emoji,
              count: c.upcomingCount,
            }))}
            value={active}
            onChange={setActive}
            label={t("events.sections", "Event sections")}
          />
          {/*
            The list is the SAME component the category page renders,
            embedded rather than navigated to. One implementation of
            the day-grouping, the Upcoming/Past switch and the empty
            states, whichever way the reader arrived.
          */}
          <EventsInCategory
            key={active ?? "all"}
            viewer={viewer}
            category={categories.find((c) => c.slug === active) ?? null}
            embedded
          />
        </>
      )}
    </SiteShell>
  );
}


/**
 * One category's calendar — /events/category/[slug].
 *
 * This is the list that used to be /events itself. The category is
 * fixed by the route now rather than chosen from a chip row, so the
 * filter state is gone: arriving here IS the filter.
 */
export function EventsInCategory({
  viewer,
  category,
  embedded = false,
}: {
  viewer: ShellViewer;
  category: { name: string; slug: string; description: string | null; emoji: string | null; color: string | null } | null;
  /**
   * Rendered UNDER the directory's tab strip rather than as its own
   * page. Drops the shell, the back link, the heading and the Submit
   * button {D} the page around it already has all four, and repeating
   * them under a tab reads as a page inside a page.
   */
  embedded?: boolean;
}) {
  const t = useT();
  const { countryId, country } = useCountry();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [events, setEvents] = useState<EventCard[] | null>(null);
  // Null means "everything", which is the /events/category/all route.
  const categorySlug = category?.slug ?? null;

  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);

  // 12 a page, and Load more appends. This used to ask for 24 and draw
  // whatever came back, which on a busy calendar was a very long page
  // and on a quiet one was three requests' worth of nothing.
  const load = useCallback(
    async (nextPage: number) => {
      if (nextPage === 1) setEvents(null);
      const params = new URLSearchParams({ perPage: "12", page: String(nextPage) });
      if (countryId) params.set("countryId", countryId);
      if (tab === "past") params.set("past", "1");
      if (categorySlug) params.set("category", categorySlug);
      const res = await fetch(`/api/user/events?${params}`).catch(() => null);
      const d = (await res?.json().catch(() => ({}))) as {
        events?: EventCard[];
        page?: number;
        pageCount?: number;
      };
      const items = d.events ?? [];
      setEvents((prev) => (nextPage === 1 ? items : [...(prev ?? []), ...items]));
      setMore((d.page ?? nextPage) < (d.pageCount ?? 1));
      setPage(nextPage);
    },
    [countryId, tab, categorySlug],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const tabClass = (active: boolean) =>
    `inline-flex min-h-11 items-center rounded-full border px-4 text-[13.5px] font-medium transition-colors duration-200 active:scale-[0.98] sm:min-h-9 ${
      active
        ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
        : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-text)]"
    }`;

  const rows = useMemo<Row[]>(() => {
    if (!events) return [];
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 86_400_000);
    let previousKey = "";
    return events.map((e) => {
      const parts = eventDateParts(e.startsAt, e.timezone);
      const startsDay = parts.dayKey !== previousKey;
      previousKey = parts.dayKey;
      return {
        ...e,
        parts,
        startsDay,
        relative:
          tab === "upcoming"
            ? relativeLabel(
                t,
                parts.dayKey,
                eventDateParts(now, e.timezone).dayKey,
                eventDateParts(tomorrow, e.timezone).dayKey,
              )
            : null,
      };
    });
  }, [events, tab, t]);

  const inner = (
    <>
      {!embedded && (
        <Link
          href="/events"
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)]"
        >
          <span aria-hidden>←</span> {t("events.allSections", "All sections")}
        </Link>
      )}

      {!embedded && (
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {category && (
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[20px]"
              style={{
                backgroundColor: category.color ? `${category.color}1f` : "var(--color-surface-muted)",
              }}
              aria-hidden
            >
              {category.emoji ?? "•"}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
              {category?.name ?? t("events.everything", "Everything")}
            </h1>
            <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
              {category?.description ??
                (country
                  ? t("events.blurbIn", "Every gathering in {country}, newest first.", {
                      country: country.name,
                    })
                  : t("events.blurb", "Every gathering, newest first."))}
            </p>
          </div>
        </div>
        <Link href="/events/new">
              <Button size="sm">{t("events.submit", "Submit an event")}</Button>
            </Link>
      </header>
      )}

      <div className="mb-4 flex gap-2">
        <button type="button" className={tabClass(tab === "upcoming")} onClick={() => setTab("upcoming")}>
          {t("events.upcoming", "Upcoming")}
        </button>
        <button type="button" className={tabClass(tab === "past")} onClick={() => setTab("past")}>
          {t("events.past", "Past")}
        </button>
      </div>

      {events === null ? (
        <ul className="divide-y divide-[color:var(--color-border-soft)] overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex animate-pulse gap-4 p-4">
              <div className="h-14 w-12 shrink-0 rounded-xl bg-[color:var(--color-surface-muted)]" />
              <div className="hidden h-20 w-28 shrink-0 rounded-xl bg-[color:var(--color-surface-muted)] sm:block" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 w-24 rounded bg-[color:var(--color-surface-muted)]" />
                <div className="h-4 w-2/3 rounded bg-[color:var(--color-surface-muted)]" />
                <div className="h-3 w-1/3 rounded bg-[color:var(--color-surface-muted)]" />
              </div>
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center shadow-card">
          <p className="text-[15px] font-medium">
            {tab === "past"
              ? t("events.noPast", "No past events")
              : category
                ? t("events.noneUnder", "Nothing under {name} yet", { name: category.name })
                : t("events.nonePlanned", "Nothing planned yet")}
          </p>
          <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">
            {tab === "past"
              ? t("events.noPastBlurb", "Events that have finished will show up here.")
              : category
                ? t("events.noneUnderBlurb", "Be the first — or look at the other sections.")
                : t(
                    "events.nonePlannedBlurb",
                    "Know something happening locally? Submit it — an admin will take a look.",
                  )}
          </p>
          {/* A column, not two loose children. Both of these are
              inline-level, so in a text-center block they landed on the
              same line and overlapped. */}
          {tab === "upcoming" && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <Link href="/events/new">
              <Button size="sm">{t("events.submit", "Submit an event")}</Button>
            </Link>
              {category && (
                <Link
                  href="/events"
                  className="text-[13px] font-semibold text-[color:var(--color-brand)] hover:underline"
                >
                  {t("events.browseOther", "Browse the other sections")}
                </Link>
              )}
            </div>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--color-border-soft)] overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
          {rows.map((e) => {
            const spotsLeft = e.capacity ? Math.max(0, e.capacity - e.rsvpCount) : null;
            const place = e.isOnline
              ? t("events.online", "Online")
              : [e.venueName, e.city].filter(Boolean).join(" · ") ||
                t("events.locationTbc", "Location TBC");

            return (
              <li key={e.id}>
                <Link
                  href={`/events/${e.slug}`}
                  className="group flex gap-3 p-3 transition-colors duration-200 hover:bg-[color:var(--color-surface-muted)] sm:gap-4 sm:p-4"
                >
                  {/* Date chip — repeated only when the day changes, so a
                      run of events on one day reads as one block. */}
                  <div className="w-11 shrink-0 text-center sm:w-12">
                    {e.startsDay ? (
                      <>
                        <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--color-brand)]">
                          {e.parts.month}
                        </span>
                        <span className="block text-[22px] font-semibold leading-tight tabular-nums tracking-[-0.02em]">
                          {e.parts.day}
                        </span>
                        <span className="block text-[10.5px] uppercase tracking-wide text-[color:var(--color-text-subtle)]">
                          {e.parts.weekday}
                        </span>
                      </>
                    ) : (
                      <span
                        aria-hidden
                        className="mx-auto mt-2 block h-1.5 w-1.5 rounded-full bg-[color:var(--color-border)]"
                      />
                    )}
                  </div>

                  <div className="hidden h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-[color:var(--color-surface-muted)] sm:block">
                    {e.coverUrl ? (
                      <Img
                        src={e.coverUrl}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[22px]">📅</div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-[color:var(--color-text-muted)]">
                      {e.relative && (
                        <span className="rounded-full bg-[color:var(--color-brand)]/10 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--color-brand)]">
                          {e.relative}
                        </span>
                      )}
                      <span className="tabular-nums">{e.parts.time}</span>
                      <span aria-hidden className="text-[color:var(--color-text-subtle)]">·</span>
                      <span className="truncate">{place}</span>
                    </p>

                    <p className="mt-0.5 line-clamp-2 text-[15.5px] font-semibold leading-snug tracking-[-0.01em]">
                      <TranslatedContent kind="event" id={e.id} field="title" text={e.title} toggle={false} />
                    </p>

                    {e.summary && (
                      <p className="mt-0.5 line-clamp-1 text-[13px] text-[color:var(--color-text-muted)]">
                        <TranslatedContent kind="event" id={e.id} field="summary" text={e.summary} toggle={false} />
                      </p>
                    )}

                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] tabular-nums text-[color:var(--color-text-subtle)]">
                      <span>{e.rsvpCount} going</span>
                      {spotsLeft !== null && (
                        <>
                          <span aria-hidden>·</span>
                          <span className={spotsLeft === 0 ? "font-semibold text-[color:var(--color-danger)]" : ""}>
                            {spotsLeft === 0
                              ? t("events.full", "Full")
                              : t("events.spotsLeft", "{n} spots left", { n: spotsLeft })}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <span
                    aria-hidden
                    className="hidden shrink-0 self-center text-[color:var(--color-text-subtle)] transition-transform duration-200 group-hover:translate-x-0.5 sm:block"
                  >
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  // Embedded, the directory already supplies the shell — nesting a
  // second one would nest the whole page furniture inside a tab.
  const withMore = (
    <>
      {inner}
      <LoadMore remaining={more ? null : 0} onMore={() => void load(page + 1)} />
    </>
  );
  return embedded ? withMore : <SiteShell viewer={viewer}>{withMore}</SiteShell>;
}
