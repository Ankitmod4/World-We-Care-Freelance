/**
 * GET  /api/admin/settings/cache — cache config + stats
 * PUT  /api/admin/settings/cache — update TTL / enabled flag
 * DELETE /api/admin/settings/cache — purge every in-process cache
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getGroup,
  purgeSettingsCache,
  setSettings,
  settingsCacheStatus,
} from "@/lib/settings";
import type { Prisma } from "@prisma/client";

const ALLOWED_KEYS = ["cache.enabled", "cache.defaultTtlSeconds"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const values = await getGroup("cache");
  const settingsCache = settingsCacheStatus();
  return NextResponse.json({
    values,
    // Reported from the cache itself rather than restated here. A
    // hard-coded "30" on this page was how the TTL setting managed to
    // look plausible while governing nothing.
    stats: [
      {
        name: "Platform settings",
        description: "In-process cache of PlatformSetting rows.",
        ttlSeconds: settingsCache.ttlSeconds,
        enabled: settingsCache.enabled,
        warm: settingsCache.warm,
        entries: settingsCache.entries,
        ageSeconds: settingsCache.ageSeconds,
      },
    ],
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const entries: Array<{ key: string; value: Prisma.InputJsonValue }> = [];
  for (const key of ALLOWED_KEYS) {
    if (body[key] !== undefined) {
      entries.push({ key, value: body[key] as Prisma.InputJsonValue });
    }
  }
  if (entries.length === 0) return NextResponse.json({ ok: true, updated: 0 });
  await setSettings(entries);
  // `setSettings` invalidates the cache, so the next read re-loads and
  // picks up the new TTL. Saying so here because "why did my new TTL
  // apply immediately" is otherwise a puzzle.
  return NextResponse.json({
    ok: true,
    updated: entries.length,
    applied: settingsCacheStatus(),
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  purgeSettingsCache();
  return NextResponse.json({ ok: true, purged: ["settings"] });
}
