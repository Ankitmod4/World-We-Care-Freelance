/**
 * Platform settings — key/value JSON store.
 *
 * Every admin-editable configuration knob (general, email, storage,
 * cache…) is a row in `platform_settings`. Reads use a small
 * in-process cache to avoid a DB round-trip on every render — the
 * cache is invalidated on any write.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

// ── Cache ─────────────────────────────────────────────────────────
// Tiny map cache — the settings table is tiny (dozens of rows) so we
// can pull the whole thing and hold it in memory. Prevents 20+
// individual reads on a single page render.
//
// THE ADMIN CACHE PAGE GOVERNS THIS ONE. `cache.enabled` and
// `cache.defaultTtlSeconds` used to be written by that page and read
// by nothing at all — a toggle that did nothing, which is worse than
// no toggle, because someone eventually turns it and believes the
// result.
//
// Configuration is read out of the map itself, on the load that
// populates it. That resolves the obvious circularity — needing the
// settings in order to decide how long to cache the settings — without
// a second query: the first load uses the defaults, and every load
// after that uses whatever the admin last saved.
const DEFAULT_TTL_SECONDS = 30;
const MIN_TTL_SECONDS = 5;
const MAX_TTL_SECONDS = 3600;

let cache: Map<string, unknown> | null = null;
let cacheLoadedAt = 0;
let ttlMs = DEFAULT_TTL_SECONDS * 1000;
let enabled = true;

function readCacheConfig(m: Map<string, unknown>): void {
  const on = m.get("cache.enabled");
  // Absent means on. A cache that switches itself off because nobody
  // has visited the settings page yet would be a nasty surprise.
  enabled = on === undefined || on === null ? true : on === true;

  const raw = Number(m.get("cache.defaultTtlSeconds"));
  const seconds = Number.isFinite(raw) && raw > 0
    ? Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, Math.floor(raw)))
    : DEFAULT_TTL_SECONDS;
  ttlMs = seconds * 1000;
}

async function ensureCache(): Promise<Map<string, unknown>> {
  const now = Date.now();
  // Disabled means every read is fresh. The map is still populated —
  // one query per read is the cost of "off", not one query per key.
  if (enabled && cache && now - cacheLoadedAt < ttlMs) return cache;

  const rows = await prisma.platformSetting.findMany({
    select: { key: true, value: true },
  });
  const m = new Map<string, unknown>();
  for (const r of rows) m.set(r.key, r.value);
  cache = m;
  cacheLoadedAt = now;
  readCacheConfig(m);
  return m;
}

function invalidate() {
  cache = null;
  cacheLoadedAt = 0;
}

/** What the cache is actually doing, for the admin page to report. */
export function settingsCacheStatus(): {
  enabled: boolean;
  ttlSeconds: number;
  warm: boolean;
  entries: number;
  ageSeconds: number | null;
} {
  return {
    enabled,
    ttlSeconds: Math.round(ttlMs / 1000),
    warm: cache !== null,
    entries: cache?.size ?? 0,
    ageSeconds: cache ? Math.round((Date.now() - cacheLoadedAt) / 1000) : null,
  };
}

// ── Typed read helpers ────────────────────────────────────────────
/**
 * Get a single setting with a fallback.
 *
 * The fallback lets callers ship an app that works BEFORE the seed
 * has run — new deployments where the row doesn't exist yet still
 * boot without a crash.
 */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const m = await ensureCache();
  const v = m.get(key);
  return v === undefined || v === null ? fallback : (v as T);
}

/** Pull every setting in a group as a { key: value } object. */
export async function getGroup(group: string): Promise<Record<string, unknown>> {
  const rows = await prisma.platformSetting.findMany({
    where: { group },
    select: { key: true, value: true },
  });
  const out: Record<string, unknown> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

// ── Write helper ──────────────────────────────────────────────────
/**
 * Upsert a batch of settings. `entries` may include NEW keys — we'll
 * create the row and infer the group from the key prefix
 * ("email.foo" → group "email"). Every write invalidates the cache.
 */
export async function setSettings(
  entries: Array<{ key: string; value: Prisma.InputJsonValue }>,
): Promise<void> {
  await Promise.all(
    entries.map((e) => {
      const group = e.key.includes(".") ? e.key.split(".")[0] : "general";
      return prisma.platformSetting.upsert({
        where: { key: e.key },
        create: { key: e.key, group, value: e.value },
        update: { value: e.value },
      });
    }),
  );
  invalidate();
}

/** Manual cache purge — used by the /admin/settings/cache page. */
export function purgeSettingsCache(): void {
  invalidate();
}
