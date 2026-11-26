/**
 * GET  /api/admin/settings/stream — read every stream.* key
 * PUT  /api/admin/settings/stream — upsert a partial update
 * POST /api/admin/settings/stream — run a live health check
 *
 * The Control API password is returned masked, same as the email key
 * on the email settings: once it is set it never round-trips in
 * cleartext, and a masked value coming back in a PUT means "leave it
 * alone" rather than "set it to bullets".
 */

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { getGroup, setSettings } from "@/lib/settings";
import { checkHealth, normalisePrefix } from "@/lib/mediamtx";

export const dynamic = "force-dynamic";

/** Four groups, matching the four sections of the settings page. */
const STRING_KEYS = [
  "stream.publicUrl",
  "stream.pathPrefix",
  "stream.apiUrl",
  "stream.apiUser",
  "stream.apiPass",
  "stream.playbackUrl",
  "stream.allowedIps",
  "stream.defaultVisibility",
] as const;

const BOOL_KEYS = [
  "stream.enabled",
  "stream.requireEmailVerified",
  "stream.autoRecord",
] as const;

/** Clamped on the way in, so a typo can't uncap a limit. */
const NUMBER_KEYS: Record<string, { min: number; max: number }> = {
  "stream.maxDurationMin": { min: 5, max: 1440 },
  "stream.maxConcurrentPerUser": { min: 1, max: 10 },
  "stream.maxHeight": { min: 240, max: 2160 },
  "stream.recordingRetentionDays": { min: 0, max: 3650 },
};

const SECRET_KEYS = new Set<string>(["stream.apiPass"]);

function mask(v: unknown): string {
  const s = typeof v === "string" ? v : "";
  if (!s) return "";
  if (s.length <= 6) return "•".repeat(s.length);
  return "•".repeat(Math.max(0, s.length - 4)) + s.slice(-4);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const values = await getGroup("stream");
  const rawPass = values["stream.apiPass"];
  return NextResponse.json({
    values: { ...values, "stream.apiPass": mask(rawPass) },
    hasPass: typeof rawPass === "string" && rawPass.length > 0,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role === "MODERATOR") {
    return NextResponse.json(
      { error: "Moderators can't change streaming settings." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const entries: Array<{ key: string; value: Prisma.InputJsonValue }> = [];

  for (const key of STRING_KEYS) {
    const incoming = body[key];
    if (incoming === undefined) continue;

    // Never overwrite a secret with its own masked read-back.
    if (SECRET_KEYS.has(key) && typeof incoming === "string" && /^•+/.test(incoming)) {
      continue;
    }

    let value = typeof incoming === "string" ? incoming.trim() : "";

    // The prefix has to reach MediaMTX in exactly one shape, so it is
    // normalised here rather than trusted from the form.
    if (key === "stream.pathPrefix") value = normalisePrefix(value);
    if (key === "stream.defaultVisibility") {
      value = value === "UNLISTED" ? "UNLISTED" : "PUBLIC";
    }
    entries.push({ key, value });
  }

  for (const key of BOOL_KEYS) {
    if (body[key] === undefined) continue;
    entries.push({ key, value: body[key] === true });
  }

  for (const [key, range] of Object.entries(NUMBER_KEYS)) {
    if (body[key] === undefined) continue;
    const n = Number(body[key]);
    if (!Number.isFinite(n)) continue;
    entries.push({
      key,
      value: Math.min(range.max, Math.max(range.min, Math.round(n))),
    });
  }

  if (entries.length > 0) await setSettings(entries);
  return NextResponse.json({ ok: true });
}

/** A real request to the media server, so the panel can say yes or no. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(await checkHealth());
}
