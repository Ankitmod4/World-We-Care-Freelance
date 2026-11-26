"use client";

/**
 * The map.
 *
 * ────────────────────────────────────────────────────────────────
 * EVERY LEAFLET REFERENCE IN THE APP IS IN THIS FILE. That is
 * deliberate:
 *
 *  • Leaflet touches `window` at import time, so it can only be
 *    imported in the browser. The page loads this component with
 *    `next/dynamic` and `ssr: false`; nothing else has to think about
 *    it.
 *  • If the package is missing or fails to load, only this component
 *    breaks — and it says so and offers the list instead, rather than
 *    taking the directory down with it.
 *
 * Requires: npm i leaflet && npm i -D @types/leaflet
 * ────────────────────────────────────────────────────────────────
 *
 * CLUSTERING IS HAND-ROLLED, on purpose. leaflet.markercluster is
 * another dependency and another set of styles to theme, and what we
 * need is simple: past a couple of hundred pins, drop them into a grid
 * of screen-sized cells and draw one badge per cell. It recomputes on
 * zoom, and clicking a cluster zooms into it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useT } from "./locale-context";

export interface MapPlace {
  id: string;
  slug: string;
  name: string;
  type: string;
  latitude: number | null;
  longitude: number | null;
  isDonor: boolean;
  city: string | null;
}

export interface Viewport {
  lat: number;
  lng: number;
  km: number;
}

/** Pins start clustering past this many, which is roughly where a map
 *  stops being readable. */
const CLUSTER_THRESHOLD = 150;
/** Cluster cell size in pixels — about a thumb. */
const CELL_PX = 64;

const TYPE_COLOURS: Record<string, string> = {
  RECOVERY_PROGRAM: "#10b981",
  CLINIC: "#ef4444",
  COUNSELLING: "#8b5cf6",
  CHURCH: "#6366f1",
  FOOD_BANK: "#f59e0b",
  ANIMAL_SHELTER: "#14b8a6",
  SHELTER: "#0ea5e9",
  COMMUNITY_CENTRE: "#64748b",
  DONATING_BUSINESS: "#22c55e",
  OTHER: "#94a3b8",
};

/**
 * Get Leaflet, whichever shape the bundler hands back.
 *
 * Leaflet 1.x ships a UMD bundle and its package.json declares no
 * `module` or `exports` field, so webpack treats it as CommonJS. A
 * dynamic `import()` of a CommonJS module resolves to a namespace
 * object whose `default` is `module.exports` — so `mod.map` is
 * undefined and `mod.default.map` is the real factory. Depending on
 * the bundler and its interop settings it can be either.
 *
 * Reading `.default` first and falling back to the namespace covers
 * both, and is why the map stopped loading: `L.map` was not a
 * function.
 */
async function loadLeaflet(): Promise<typeof import("leaflet")> {
  const mod = (await import("leaflet")) as unknown as {
    default?: typeof import("leaflet");
    map?: unknown;
  };
  const L = (typeof mod.map === "function" ? mod : mod.default) as
    | typeof import("leaflet")
    | undefined;
  if (!L || typeof L.map !== "function") {
    throw new Error("Leaflet loaded but has no map() — check the package version.");
  }
  return L;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

export function PlaceMap({
  places,
  centre,
  onViewportChange,
  onSelect,
  selectedId,
  className,
}: {
  places: MapPlace[];
  centre?: { lat: number; lng: number } | null;
  onViewportChange?: (v: Viewport) => void;
  onSelect?: (slug: string) => void;
  selectedId?: string | null;
  className?: string;
}) {
  const t = useT();
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Keep the newest callbacks without re-creating the map.
  const onViewport = useRef(onViewportChange);
  const onPick = useRef(onSelect);
  useEffect(() => {
    onViewport.current = onViewportChange;
    onPick.current = onSelect;
  }, [onViewportChange, onSelect]);

  /* ── create the map, once ─────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !holder.current || map.current) return;
        // React StrictMode mounts effects twice in development. Leaflet
        // throws "Map container is already initialized" if the same
        // element is handed to it again, so check the marker it leaves
        // behind rather than relying on our own ref alone.
        if ((holder.current as HTMLElement & { _leaflet_id?: number })._leaflet_id) return;
        leaflet.current = L;

        const instance = L.map(holder.current, {
          center: [centre?.lat ?? 53.8, centre?.lng ?? -1.55],
          zoom: centre ? 12 : 5,
          scrollWheelZoom: false, // a map that eats the page scroll is a menace
          attributionControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          // Attribution is a condition of using OSM tiles, not a nicety.
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(instance);

        layer.current = L.layerGroup().addTo(instance);
        map.current = instance;

        const report = () => {
          const c = instance.getCenter();
          const bounds = instance.getBounds();
          // Half the diagonal, which is what the box query wants.
          const km = c.distanceTo(bounds.getNorthEast()) / 1000;
          onViewport.current?.({ lat: c.lat, lng: c.lng, km: Math.max(1, Math.round(km)) });
        };
        instance.on("moveend", report);
        instance.on("zoomend", report);

        // Leaflet measures the container on creation; inside a tab or a
        // freshly-laid-out grid that measurement is often zero.
        setTimeout(() => instance.invalidateSize(), 0);
        setReady(true);
        report();
      } catch (err) {
        console.error("[map] Leaflet failed to load:", err);
        if (!cancelled) setFailed(err instanceof Error ? err.message : "Unknown error");  // technical, never shown as prose  // technical, never shown as prose
      }
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
    // Created once. `centre` is only the initial view; later changes go
    // through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── recentre when the caller asks ────────────────────────── */
  useEffect(() => {
    if (!map.current || !centre) return;
    map.current.setView([centre.lat, centre.lng], Math.max(map.current.getZoom(), 12));
  }, [centre]);

  /* ── draw the pins ────────────────────────────────────────── */
  const draw = useCallback(() => {
    const L = leaflet.current;
    const instance = map.current;
    const group = layer.current;
    if (!L || !instance || !group) return;

    group.clearLayers();
    const mappable = places.filter(
      (p) => typeof p.latitude === "number" && typeof p.longitude === "number",
    );
    if (mappable.length === 0) return;

    const shouldCluster = mappable.length > CLUSTER_THRESHOLD;

    if (!shouldCluster) {
      for (const p of mappable) {
        const colour = p.isDonor ? "#22c55e" : (TYPE_COLOURS[p.type] ?? TYPE_COLOURS.OTHER);
        const selected = selectedId === p.id;
        const marker = L.circleMarker([p.latitude as number, p.longitude as number], {
          radius: selected ? 11 : 8,
          weight: selected ? 3 : 2,
          color: "#ffffff",
          fillColor: colour,
          fillOpacity: 1,
        });
        // Names come from the database and are shown as HTML here, so
        // they are escaped — a place called `<img onerror=…>` must not
        // become script in a popup.
        marker.bindTooltip(
          `<strong>${escapeHtml(p.name)}</strong>${p.city ? `<br>${escapeHtml(p.city)}` : ""}`,
          { direction: "top" },
        );
        marker.on("click", () => onPick.current?.(p.slug));
        marker.addTo(group);
      }
      return;
    }

    // Grid clustering, in screen space so cells stay the same visual
    // size at every zoom level.
    const cells = new Map<string, { count: number; latSum: number; lngSum: number }>();
    for (const p of mappable) {
      const pt = instance.latLngToContainerPoint([p.latitude as number, p.longitude as number]);
      const key = `${Math.floor(pt.x / CELL_PX)}:${Math.floor(pt.y / CELL_PX)}`;
      const cell = cells.get(key) ?? { count: 0, latSum: 0, lngSum: 0 };
      cell.count += 1;
      cell.latSum += p.latitude as number;
      cell.lngSum += p.longitude as number;
      cells.set(key, cell);
    }

    for (const cell of cells.values()) {
      const lat = cell.latSum / cell.count;
      const lng = cell.lngSum / cell.count;
      if (cell.count === 1) {
        L.circleMarker([lat, lng], {
          radius: 8,
          weight: 2,
          color: "#ffffff",
          fillColor: TYPE_COLOURS.OTHER,
          fillOpacity: 1,
        }).addTo(group);
        continue;
      }
      const size = cell.count > 99 ? 46 : cell.count > 9 ? 40 : 34;
      const badge = L.divIcon({
        className: "",
        html:
          `<div style="width:${size}px;height:${size}px;border-radius:9999px;` +
          `background:rgba(14,165,233,0.9);color:#fff;display:flex;align-items:center;` +
          `justify-content:center;font:600 13px/1 system-ui;border:2px solid #fff;` +
          `box-shadow:0 2px 8px rgba(0,0,0,0.25)">${cell.count}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      L.marker([lat, lng], { icon: badge })
        .on("click", () => instance.setView([lat, lng], Math.min(19, instance.getZoom() + 2)))
        .addTo(group);
    }
  }, [places, selectedId]);

  useEffect(() => {
    if (!ready) return;
    draw();
    const instance = map.current;
    if (!instance) return;
    // Clusters are computed in screen space, so they have to be redrawn
    // whenever the projection changes.
    instance.on("zoomend", draw);
    instance.on("moveend", draw);
    return () => {
      instance.off("zoomend", draw);
      instance.off("moveend", draw);
    };
  }, [draw, ready]);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] p-8 text-center ${className ?? ""}`}
      >
        <p className="text-[14px] font-medium">{t("map.failed", "The map couldn\u2019t load")}</p>
        <p className="max-w-[40ch] text-[13px] text-[color:var(--color-text-muted)]">
          {t(
            "map.failedHint",
            "Everything is still here in the list view \u2014 switch to it with the toggle above.",
          )}
        </p>
        <p className="max-w-[46ch] font-mono text-[11px] text-[color:var(--color-text-subtle)]">
          {failed}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={holder}
      className={`overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] ${className ?? ""}`}
      // Leaflet needs a real height before it will render anything.
      style={{ minHeight: 420 }}
    />
  );
}
