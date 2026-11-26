/**
 * Address → coordinates, via OpenStreetMap's Nominatim.
 *
 * ────────────────────────────────────────────────────────────────
 * READ THE USAGE POLICY BEFORE CHANGING ANY OF THIS.
 * https://operations.osmfoundation.org/policies/nominatim/
 *
 * Nominatim is free and run on donated hardware. The rules that
 * matter, and how they are honoured here:
 *
 *  1. AT MOST ONE REQUEST PER SECOND, globally — not per user, not
 *     per request handler. Every call goes through a single promise
 *     chain that will not let two lookups start within a second of
 *     each other.
 *
 *  2. A REAL User-Agent identifying the application, with a way to
 *     contact us. A generic or absent one gets the whole IP blocked.
 *
 *  3. NO BULK GEOCODING, and never on page render. This module is
 *     called when a place is CREATED OR ITS ADDRESS CHANGES, and the
 *     result is written to the row. A map that geocoded its pins on
 *     load would issue hundreds of requests per visitor and be blocked
 *     within the hour.
 *
 * If this ever needs to run over thousands of rows, the answer is a
 * paid provider or a self-hosted Nominatim, not a faster loop.
 * ────────────────────────────────────────────────────────────────
 */

const ENDPOINT = "https://nominatim.openstreetmap.org/search";

/** Overridable so a deployment can point at its own Nominatim. */
function endpoint(): string {
  return process.env.NOMINATIM_URL?.trim() || ENDPOINT;
}

/**
 * Identifies the app to Nominatim. Set GEOCODER_CONTACT to a real
 * address for the deployment — the policy asks for one, and it is what
 * they use to warn you before blocking rather than after.
 */
function userAgent(): string {
  const contact = process.env.GEOCODER_CONTACT?.trim() || "admin@worldwecare.example";
  return `WorldWeCare/1.0 (+${contact})`;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  /** What Nominatim thinks the address is — useful for a sanity check. */
  displayName: string;
}

export type GeocodeOutcome =
  | { ok: true; result: GeocodeResult }
  | { ok: false; error: string };

/* ── the one-per-second gate ─────────────────────────────────── */

const MIN_INTERVAL_MS = 1100; // a little over a second, deliberately
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Serialise every lookup and space them out. Callers await their turn;
 * nothing is dropped.
 *
 * This is a per-process gate. Behind several Node processes it would
 * need to be shared — a note worth keeping if this app is ever scaled
 * horizontally.
 */
function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return task();
  });
  // Keep the chain alive even when a link rejects.
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/* ── the lookup ──────────────────────────────────────────────── */

export interface AddressParts {
  addressLine?: string | null;
  city?: string | null;
  postcode?: string | null;
  state?: string | null;
  country?: string | null;
}

/** A single line, skipping the parts that were left blank. */
export function addressToQuery(parts: AddressParts): string {
  return [parts.addressLine, parts.city, parts.postcode, parts.state, parts.country]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");
}

export async function geocode(parts: AddressParts): Promise<GeocodeOutcome> {
  const q = addressToQuery(parts);
  if (!q) return { ok: false, error: "No address to look up." };

  if (process.env.GEOCODING_DISABLED === "1") {
    return { ok: false, error: "Geocoding is switched off (GEOCODING_DISABLED=1)." };
  }

  return schedule(async () => {
    const url = new URL(endpoint());
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    // Nominatim's own advice: ask for the language you'll display in,
    // so the returned display name is legible to the admin checking it.
    url.searchParams.set("accept-language", "en");

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      const res = await fetch(url, {
        headers: { "User-Agent": userAgent(), Accept: "application/json" },
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (res.status === 429 || res.status === 403) {
        // Being rate-limited or blocked is worth saying out loud rather
        // than filing under "not found".
        return {
          ok: false as const,
          error: `Nominatim refused the request (HTTP ${res.status}). Check the rate limit and User-Agent.`,
        };
      }
      if (!res.ok) {
        return { ok: false as const, error: `Lookup failed (HTTP ${res.status}).` };
      }

      const body = (await res.json()) as Array<{
        lat?: string;
        lon?: string;
        display_name?: string;
      }>;
      const hit = Array.isArray(body) ? body[0] : undefined;
      if (!hit?.lat || !hit?.lon) {
        return { ok: false as const, error: `No match for “${q}”.` };
      }

      const latitude = Number(hit.lat);
      const longitude = Number(hit.lon);
      if (!isValidCoordinate(latitude, longitude)) {
        return { ok: false as const, error: "The lookup returned coordinates that aren't valid." };
      }

      return {
        ok: true as const,
        result: { latitude, longitude, displayName: hit.display_name ?? q },
      };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { ok: false as const, error: "The lookup timed out." };
      }
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "The lookup failed.",
      };
    }
  });
}

/**
 * Rejects the ranges AND the null island. (0, 0) is in the Gulf of
 * Guinea and is what a half-failed geocode looks like — a pin there is
 * always a bug, never a place.
 */
export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

/* ── distance, for "near me" ordering ────────────────────────── */

/**
 * Great-circle distance in kilometres.
 *
 * Used for sorting a page of results that a bounding box has already
 * narrowed. Doing the trigonometry in SQL across every row would be a
 * full table scan; the box uses the index, this orders what comes back.
 */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * A latitude/longitude box roughly `km` around a point, for the map's
 * viewport query. Longitude degrees shrink towards the poles, hence
 * the cosine; clamped so a box near a pole can't produce nonsense.
 */
export function boundingBox(lat: number, lng: number, km: number) {
  const latDelta = km / 111;
  const lngDelta = km / (111 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  return {
    minLat: Math.max(-90, lat - latDelta),
    maxLat: Math.min(90, lat + latDelta),
    minLng: Math.max(-180, lng - lngDelta),
    maxLng: Math.min(180, lng + lngDelta),
  };
}
