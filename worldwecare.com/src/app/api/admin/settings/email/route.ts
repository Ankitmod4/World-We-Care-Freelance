/**
 * GET  /api/admin/settings/email — read every email.* key
 * PUT  /api/admin/settings/email — upsert a partial update
 *
 * The API key is returned masked (last 4 chars only) so it
 * never round-trips in cleartext once it's set. Empty string is
 * still meaningful — clearing the key disables sends.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getGroup, setSettings } from "@/lib/settings";
import type { Prisma } from "@prisma/client";

const ALLOWED_KEYS = [
  "email.provider",
  "email.resendApiKey",
  "email.fromEmail",
  "email.fromName",
  "email.replyToEmail",
  "email.enabled",
] as const;

function maskKey(v: unknown): string {
  const s = typeof v === "string" ? v : "";
  if (!s) return "";
  if (s.length <= 6) return "•".repeat(s.length);
  return "•".repeat(Math.max(0, s.length - 4)) + s.slice(-4);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const values = await getGroup("email");
  // Send back a MASKED version of the API key. The unmasked hint
  // (has-key: boolean) lets the UI show "key set — replace it?" copy
  // without exposing bytes.
  const rawKey = values["email.resendApiKey"];
  const hasKey = typeof rawKey === "string" && rawKey.length > 0;
  return NextResponse.json({
    values: {
      ...values,
      "email.resendApiKey": maskKey(rawKey),
    },
    hasKey,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const entries: Array<{ key: string; value: Prisma.InputJsonValue }> = [];
  for (const key of ALLOWED_KEYS) {
    if (body[key] !== undefined) {
      // Never overwrite the API key with the masked read-back — the
      // client is expected to omit the field when the admin hasn't
      // re-entered it. Treat "•" characters as "no change" as a safety
      // net for anyone hand-crafting a request.
      if (key === "email.resendApiKey") {
        const v = body[key];
        if (typeof v === "string" && v.includes("•")) continue;
      }
      entries.push({ key, value: body[key] as Prisma.InputJsonValue });
    }
  }
  if (entries.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }
  await setSettings(entries);
  return NextResponse.json({ ok: true, updated: entries.length });
}
