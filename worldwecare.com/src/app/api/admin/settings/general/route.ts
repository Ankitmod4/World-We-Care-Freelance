/**
 * GET  /api/admin/settings/general — read every general.* key
 * PUT  /api/admin/settings/general — upsert a partial update
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getGroup, setSettings } from "@/lib/settings";
import type { Prisma } from "@prisma/client";

const ALLOWED_KEYS = [
  "general.siteName",
  "general.tagline",
  "general.description",
  "general.textLogo",
  "general.svgLogo",
  "general.logoUrl",
  "general.faviconUrl",
  "general.supportEmail",
] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const values = await getGroup("general");
  return NextResponse.json({ values });
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
  if (entries.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }
  await setSettings(entries);
  return NextResponse.json({ ok: true, updated: entries.length });
}
