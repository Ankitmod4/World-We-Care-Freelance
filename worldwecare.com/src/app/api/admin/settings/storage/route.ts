/**
 * GET/PUT /api/admin/settings/storage — file storage config.
 *
 * The numeric limits are validated HERE, not only in the form. A cap
 * that only exists in a React component is not a cap: this endpoint is
 * reachable directly, and `storage.maxVideoMB` above the build-time
 * body ceiling would mean Next truncating uploads silently instead of
 * the app rejecting them with a message.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getGroup, setSettings } from "@/lib/settings";
import { BODY_LIMIT_MB } from "@/lib/upload-limits";
import type { Prisma } from "@prisma/client";

const STRING_KEYS = ["storage.provider", "storage.localPath", "storage.publicBaseUrl"] as const;

/** key → [min, max] in the key's own unit. */
const NUMBER_KEYS: Record<string, [number, number]> = {
  "storage.maxFileMB": [1, 1024],
  "storage.maxVideoMB": [1, BODY_LIMIT_MB],
  // 0 = no limit; 24 hours is a generous ceiling for a "clip".
  "storage.maxVideoSeconds": [0, 86_400],
};

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const values = await getGroup("storage");
  return NextResponse.json({ values, bodyLimitMB: BODY_LIMIT_MB });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const entries: Array<{ key: string; value: Prisma.InputJsonValue }> = [];

  for (const key of STRING_KEYS) {
    if (body[key] !== undefined) {
      entries.push({ key, value: String(body[key]).slice(0, 500) });
    }
  }

  for (const [key, [min, max]] of Object.entries(NUMBER_KEYS)) {
    if (body[key] === undefined) continue;
    const raw = body[key];
    const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number(raw);
    if (!Number.isFinite(n) || n < min || n > max) {
      return NextResponse.json(
        {
          error:
            key === "storage.maxVideoMB"
              ? `Max video size must be between ${min} and ${max} MB. The upper bound is this build's request body limit — raise MAX_UPLOAD_BODY_MB and rebuild to go higher.`
              : `${key} must be between ${min} and ${max}.`,
        },
        { status: 400 },
      );
    }
    entries.push({ key, value: Math.floor(n) });
  }

  if (entries.length === 0) return NextResponse.json({ ok: true, updated: 0 });
  await setSettings(entries);
  return NextResponse.json({ ok: true, updated: entries.length });
}
