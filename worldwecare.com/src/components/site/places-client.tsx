"use client";

/**
 * /places — the directory.
 *
 * Three views over one query. List, map and saved all hit the same
 * endpoint with the same filters; the map adds a viewport and saved
 * adds one flag. That is the whole reason they can't disagree about
 * what exists — and why the type chips still work inside Saved.
 *
 * The map is loaded with `next/dynamic` and `ssr: false` because
 * Leaflet touches `window` at import time. Nothing else in the app
 * knows Leaflet exists.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { useCountry } from "./country-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { placeTypeEmoji, type PlaceTypeValue, type PlaceTypeTile } from "@/lib/places";
import { CategoryTabs } from "./category-tabs";
import { PlaceRow, type PlaceCard } from "./place-row";
import type { Viewport } from "./place-map";
import { PageHeading } from "./page-heading";
import { useT } from "./locale-context";
import { placeKindLabel } from "@/lib/place-kinds-text";

/**
 * How many places sit under the tiles before "Show all".
 *
 * The landing screen's job is to point somewhere — the tiles do that,
 * and a full run of fifty rows underneath buries them under a scroll
 * nobody asked for. Six is two rows of the two-column grid: enough to
 * show the list is real and worth scrolling, not enough to be the
 * page. Once the reader searches, filters, or presses Show all they
 * are browsing rather than arriving, and the cap comes off.
 */
const LANDING_PREVIEW = 6;

const PlaceMap = dynamic(() => import("./place-map").then((m) => m.PlaceMap), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)]">
      <span className="text-[13px] text-[color:var(--color-text-subtle)]">Loading the map\u2026</span>
    </div>
  ),
});

interface RegionOption {
  id: string;
  name: string;
}

interface FilterSet {
  id: string;
  name: string;
  filters: { types?: PlaceTypeValue[]; donorOnly?: boolean; stateId?: string; q?: string };
}

export function PlacesClient({
  viewer,
}: {
  viewer: ShellViewer;
}) {
  const t = useT();
  const { countryId, country } = useCountry();
  const [view, setView] = useState<"list" | "map" | "saved">("list");
  const [types, setTypes] = useState<PlaceTypeValue[]>([]);
  const [donorOnly, setDonorOnly] = useState(false);
  const [stateId, setStateId] = useState("");
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [q, setQ] = useState("");
  const [places, setPlaces] = useState<PlaceCard[] | null>(null);
  const [total, setTotal] = useState(0);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [centre, setCentre] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [sets, setSets] = useState<FilterSet[]>([]);
  const [typeTiles, setTypeTiles] = useState<PlaceTypeTile[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [savingSet, setSavingSet] = useState(false);

  /* Newest request wins — toggling several type chips in a second
     puts two or three requests in flight, and the slowest finishing
     last would otherwise decide what is on screen. */
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    const params = new URLSearchParams({ perPage: view === "map" ? "200" : "50" });
    if (types.length) params.set("types", types.join(","));
    if (donorOnly) params.set("donorOnly", "1");
    if (countryId) params.set("countryId", countryId);
    if (stateId) params.set("stateId", stateId);
    if (q.trim()) params.set("q", q.trim());
    if (view === "saved") params.set("saved", "1");
    if (view === "map") {
      params.set("mappable", "1");
      if (viewport) {
        params.set("lat", String(viewport.lat));
        params.set("lng", String(viewport.lng));
        params.set("km", String(viewport.km));
      }
    }
    const res = await fetch(`/api/user/places?${params}`, { cache: "no-store" });
    const d = (await res.json().catch(() => ({ places: [], total: 0 }))) as {
      places: PlaceCard[];
      total: number;
    };
    if (seq !== loadSeq.current) return;
    setPlaces(d.places ?? []);
    setTotal(d.total ?? 0);
  }, [types, donorOnly, countryId, stateId, q, view, viewport]);

  useEffect(() => {
    // Debounced: panning the map fires a viewport change per frame of
    // inertia, and each one would otherwise be a request.
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    // A different country is a different directory: "showing all 43"
    // should not carry over to a list that now has three.
    setShowAll(false);
  }, [countryId]);

  useEffect(() => {
    // Regions belong to a country, so a country change invalidates both
    // the list and whatever was selected from the old one.
    setStateId("");
    if (!countryId) {
      setRegions([]);
      return;
    }
    void fetch(`/api/public/geo/states?countryId=${encodeURIComponent(countryId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items?: RegionOption[] } | null) => setRegions(d?.items ?? []))
      .catch(() => setRegions([]));
  }, [countryId]);

  useEffect(() => {
    // The tiles depend only on the country, not on the filters — they
    // are the way IN to filtering, so re-fetching them every time a
    // chip is pressed would renumber the door somebody just walked
    // through.
    const params = countryId ? `?countryId=${encodeURIComponent(countryId)}` : "";
    void fetch(`/api/public/place-types${params}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { types?: PlaceTypeTile[] } | null) => setTypeTiles(d?.types ?? []))
      .catch(() => setTypeTiles([]));
  }, [countryId]);

  useEffect(() => {
    void fetch("/api/user/places/filters")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { sets?: FilterSet[] } | null) => setSets(d?.sets ?? []))
      .catch(() => {});
  }, []);

  /**
   * Only ever called to take one OFF now — the tiles are how a type
   * goes on, and they navigate to their own page rather than filtering
   * here. Left as a toggle rather than a `removeType`, because a set
   * applied from a saved filter can still bring several in and the
   * symmetry is one less thing to reason about.
   */
  const toggleType = (t: PlaceTypeValue) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCentre({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setView("map");
        setLocating(false);
      },
      // A refusal is a perfectly normal answer; the directory works
      // without it.
      () => setLocating(false),
      { timeout: 10_000 },
    );
  };

  const saveCurrentFilters = async () => {
    const name = window.prompt(t("places.nameFilterSet", "Name this filter set"), suggestedName);
    if (!name?.trim()) return;
    setSavingSet(true);
    const res = await fetch("/api/user/places/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        filters: { types, donorOnly, stateId: stateId || undefined, q: q.trim() || undefined },
      }),
    });
    setSavingSet(false);
    if (!res.ok) return;
    const d = (await res.json()) as { set: FilterSet };
    setSets((prev) => [d.set, ...prev]);
  };

  const applySet = (set: FilterSet) => {
    setTypes(set.filters.types ?? []);
    setDonorOnly(set.filters.donorOnly ?? false);
    setQ(set.filters.q ?? "");
    // A set saved while a different country was selected can name a region
    // that isn't on offer now. Applying it would filter by a region the
    // dropdown can't show, which reads as "no results, no reason".
    const region = set.filters.stateId;
    setStateId(region && regions.some((r) => r.id === region) ? region : "");
  };

  const removeSet = async (id: string) => {
    setSets((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/user/places/filters/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const suggestedName = useMemo(() => {
    if (types.length === 1) return placeKindLabel(t, types[0]);
    if (types.length > 1) return t("places.nTypes", "{n} types", { n: types.length });
    if (donorOnly) return t("places.donating", "Donating businesses");
    return q.trim() || t("places.myFilter", "My filter");
  }, [types, donorOnly, q, t]);

  const hasFilters = types.length > 0 || donorOnly || stateId !== "" || q.trim() !== "";

  /*
   * ARRIVING, as opposed to browsing. One definition, used three
   * times — the tiles show, the list is capped, and "Show all" is
   * offered — because three separate conditions would drift into a
   * state where the cap is on and the button that removes it is not
   * on the page.
   */
  const landing = view === "list" && !hasFilters && !showAll;

  const toggleSave = async (id: string) => {
    const wasSaved = places?.find((p) => p.id === id)?.saved ?? false;
    const flip = (prev: PlaceCard[] | null) =>
      prev?.map((p) =>
        p.id === id ? { ...p, saved: !p.saved, saveCount: p.saveCount + (p.saved ? -1 : 1) } : p,
      ) ?? prev;

    setPlaces(flip);
    const res = await fetch(`/api/user/places/${id}/save`, { method: "POST" }).catch(() => null);
    if (!res?.ok) {
      setPlaces(flip);
      return;
    }
    // In the Saved view an un-save has taken the place out of the list the
    // server would now return, so take it out of the one on screen too —
    // otherwise it sits there looking saved-but-not until the next fetch.
    if (view === "saved" && wasSaved) {
      setPlaces((prev) => prev?.filter((p) => p.id !== id) ?? prev);
      setTotal((t) => Math.max(0, t - 1));
    }
  };

  const viewBtn = (active: boolean) =>
    `inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors duration-200 ${
      active
        ? "bg-[color:var(--color-surface)] text-[color:var(--color-text)] shadow-card"
        : "text-[color:var(--color-text-muted)]"
    }`;

  return (
    <SiteShell viewer={viewer}>
      <PageHeading
        title={t("page.placesTitle", "Places")}
        intro={t("page.placesIntro", "Somewhere to walk into{country} — programs, clinics, food banks, shelters and the people who help.")}
        country={country?.name}
        actions={
          <Link href="/places/new">
              <Button size="sm">{t("places.add", "Add a place")}</Button>
            </Link>
        }
      />

      {/*
        SEARCH FIRST, above the tiles.

        Somebody who arrives knowing the name of the place they want —
        or the town, or the thing they need — should not have to scroll
        past ten category tiles to type it. The tiles are for the
        reader who does NOT know what they are looking for, which makes
        them the second question, not the first.
      */}
      <div className="mb-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("places.searchPlaceholder", "Search by name, city or what they need…")}
            className="h-9 min-w-[200px] flex-1 text-[13px]"
          />

          {regions.length > 0 && (
            <select
              value={stateId}
              onChange={(e) => setStateId(e.target.value)}
              aria-label={t("places.region", "Region")}
              className="h-9 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[12.5px] font-medium text-[color:var(--color-text-muted)]"
            >
              <option value="">{t("places.everywhere", "Everywhere")}</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[12.5px] font-medium text-[color:var(--color-text-muted)] hover:border-[color:var(--color-brand)] disabled:opacity-50"
          >
            📍 {locating ? t("places.locating", "Finding you…") : t("places.nearMe", "Near me")}
          </button>
        </div>

        <div className="inline-flex rounded-full bg-[color:var(--color-surface-muted)] p-0.5">
          <button type="button" onClick={() => setView("list")} className={viewBtn(view === "list")}>
            {t("places.viewList", "List")}
          </button>
          <button type="button" onClick={() => setView("map")} className={viewBtn(view === "map")}>
            {t("places.viewMap", "Map")}
          </button>
          <button type="button" onClick={() => setView("saved")} className={viewBtn(view === "saved")}>
            {t("places.viewSaved", "Saved")}
          </button>
        </div>
      </div>

      {/*
        THE TILES ARE THE FRONT DOOR, the chips below are the tool.
        Shown only in the list view with nothing filtered — which is
        the state somebody arrives in. Once they are filtering, or on
        the map, the chips are what they are using and a grid of
        category tiles is a screen-height of noise between them and
        the results.

        THE TYPE CHIP ROW THAT USED TO SIT UNDER THIS IS GONE. It
        listed the same ten types the tiles do, immediately below them,
        which is one control too many for one question. What is left
        below is what the tiles cannot say: the donor filter, and
        whatever is currently switched on.
      */}
      {landing && typeTiles !== null && (
        <CategoryTabs
          /*
             NO `kind` HERE, unlike every other tab strip on the site:
             these are not rows in a table, they are the fixed list of
             kinds of place. Their names are interface text and go
             through `t()` like any other label, which is both cheaper
             and better than paying Google per language.
          */
          categories={typeTiles.map((tile) => ({
            id: tile.value,
            name: placeKindLabel(t, tile.value),
            slug: tile.slug,
            emoji: tile.emoji,
            count: tile.count,
          }))}
          // The tabs ARE the type filter, rather than a second control
          // pointing at a page that applies it. One type at a time:
          // the old chip row allowed several at once, which nothing in
          // the copy explained and almost nobody used.
          value={types.length === 1 ? (typeTiles.find((t) => t.value === types[0])?.slug ?? null) : null}
          onChange={(slug) => {
            const hit = typeTiles.find((t) => t.slug === slug);
            setTypes(hit ? [hit.value] : []);
          }}
          allLabel={t("places.all", "All places")}
          label={t("places.kinds", "Kinds of place")}
          heading={t("places.browseByKind", "Browse by kind")}
        />
      )}

      {/* ── what the tiles can't say ─────────────────────── */}
      <div className="mb-3 space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {/*
            ONLY THE TYPES ACTUALLY SWITCHED ON, each removable —
            never the full list. There is no way to turn one ON from
            here any more (the tiles do that), but a saved filter set
            can still carry types, and a filter nobody can see is one
            nobody can undo: the list would come back short with
            nothing on the page explaining why.
          */}
          {types.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => toggleType(value)}
              aria-pressed
              aria-label={t("places.removeFilter", "Remove the {kind} filter", {
                kind: placeKindLabel(t, value),
              })}
              className="inline-flex min-h-8 items-center gap-1 rounded-full border border-[color:var(--color-brand)] bg-[color:var(--color-brand)] px-2.5 text-[12px] font-medium text-[color:var(--color-on-brand)]"
            >
              <span aria-hidden>{placeTypeEmoji(value)}</span>
              {placeKindLabel(t, value)}
              <svg width="10" height="10" viewBox="0 0 20 20" fill="none" aria-hidden className="ml-0.5">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDonorOnly((d) => !d)}
            aria-pressed={donorOnly}
            className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-[12px] font-medium transition-colors duration-200 ${
              donorOnly
                ? "border-[color:var(--color-success)] bg-[color:var(--color-success)] text-[color:var(--color-on-success)]"
                : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)]"
            }`}
          >
            💚 {t("places.donatesLocally", "Donates locally")}
          </button>
        </div>

        {(sets.length > 0 || hasFilters) && (
          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            {sets.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-surface-muted)] py-1 pl-2.5 pr-1"
              >
                <button type="button" onClick={() => applySet(s)} className="font-medium hover:underline">
                  {s.name}
                </button>
                <button
                  type="button"
                  onClick={() => void removeSet(s.id)}
                  aria-label={`Remove ${s.name}`}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-danger)]"
                >
                  <svg width="10" height="10" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                </button>
              </span>
            ))}
            {hasFilters && (
              <>
                <button
                  type="button"
                  onClick={() => void saveCurrentFilters()}
                  disabled={savingSet}
                  className="font-medium text-[color:var(--color-brand)] hover:underline disabled:opacity-50"
                >
                  {t("places.saveFilters", "Save these filters")}
                </button>
                <button
                  type="button"
                  // Clear means back to the start, which includes the
                  // tiles — otherwise clearing a filter leaves the
                  // front door shut with nothing on the page that
                  // opens it again.
                  onClick={() => { setTypes([]); setDonorOnly(false); setStateId(""); setQ(""); setShowAll(false); }}
                  className="text-[color:var(--color-text-muted)] hover:underline"
                >
                  {t("common.clear", "Clear")}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="mb-3 text-[12px] tabular-nums text-[color:var(--color-text-subtle)]">
        {places === null
          ? t("common.loading", "Loading\u2026")
          : landing && total > LANDING_PREVIEW
            ? // Say what is on screen AND what there is, or "6" reads
              // as the size of the directory.
              t("places.someOfTotal", "{shown} of {total} places", {
                shown: Math.min(LANDING_PREVIEW, places.length),
                total,
              })
            : total === 1
              ? t("places.onePlace", "1 place")
              : t("places.nPlaces", "{n} places", { n: total })}
        {places !== null && view === "map" && viewport ? " in view" : ""}
        {places !== null && view === "saved" ? " saved" : ""}
      </p>

      {/* ── the two views ────────────────────────────────── */}
      {view === "map" ? (
        // No side rail: the map gets the whole width. The list lives in the
        // list view, and markers carry their own tooltip and detail link.
        <PlaceMap
          places={places ?? []}
          centre={centre}
          onViewportChange={setViewport}
          onSelect={(slug) => setSelected(slug)}
          selectedId={places?.find((p) => p.slug === selected)?.id ?? null}
          className="min-h-[480px] lg:min-h-[680px]"
        />
      ) : places === null ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)]"
            />
          ))}
        </div>
      ) : places.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center shadow-card">
          {view === "saved" && !hasFilters ? (
            <>
              <p className="text-[15px] font-medium">{t("places.noneSaved", "Nothing saved yet")}</p>
              <p className="mx-auto mt-1 max-w-[42ch] text-[13.5px] text-[color:var(--color-text-muted)]">
                {t(
                  "places.noneSavedBlurb",
                  "The bookmark on any place puts it here, so you can find it again without remembering the name.",
                )}
              </p>
              <Button size="sm" variant="secondary" className="mt-4" onClick={() => setView("list")}>
                {t("places.browse", "Browse places")}
              </Button>
            </>
          ) : (
            <>
              <p className="text-[15px] font-medium">{t("places.noMatches", "Nothing matches")}</p>
              <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">
                {hasFilters
                  ? t("places.noMatchesFiltered", "Try clearing a filter, or widening the search.")
                  : t(
                      "places.noMatchesBlurb",
                      "Know somewhere that belongs here? Add it — an admin will take a look.",
                    )}
              </p>
              <Link href="/places/new" className="mt-4">
              <Button size="sm">{t("places.add", "Add a place")}</Button>
            </Link>
            </>
          )}
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/*
              Capped on arrival. Sliced here rather than asked for in
              the query, because the number under the tiles and the
              number in the count line come from the same fetch — a
              second request for six would make `total` a claim about a
              list nobody has.
            */}
            {(landing ? places.slice(0, LANDING_PREVIEW) : places).map((p) => (
              <li key={p.id}>
                <PlaceRow place={p} onToggleSave={() => void toggleSave(p.id)} />
              </li>
            ))}
          </ul>

          {landing && total > LANDING_PREVIEW && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="inline-flex min-h-10 items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 text-[13px] font-medium transition-colors hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)]"
              >
                {t("places.showAll", "Show all {n} places", { n: total })}
              </button>
            </div>
          )}
        </>
      )}
    </SiteShell>
  );
}
