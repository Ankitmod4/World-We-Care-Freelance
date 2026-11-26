/**
 * GET   — every language, with how far along each one is.
 * POST  — { action: "sync" }            pull Google's list into the DB
 *         { action: "key", apiKey }     store the Google key (or "" to clear)
 *         { action: "picker", on }      show or hide the member language control
 *         { code, isEnabled }           turn one on or off
 *         { code, sortOrder }           move it in the member picker
 *
 * THE KEY GOES IN AND NEVER COMES OUT. GET returns whether one is
 * set, where it came from and its last four characters; there is no
 * route that returns the key itself, because the only caller would be
 * a page that then has the credential in its HTML.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  listLocalesWithProgress,
  setLocaleEnabled,
  setLocaleOrder,
  syncSupportedLanguages,
  setPickerEnabled,
  setTranslationKey,
  translationKeyStatus,
} from "@/lib/translations-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const [progress, keyStatus] = await Promise.all([
    listLocalesWithProgress(),
    translationKeyStatus(),
  ]);
  return NextResponse.json({ ...progress, ...keyStatus });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    apiKey?: string;
    code?: string;
    isEnabled?: boolean;
    sortOrder?: number;
    on?: boolean;
  };

  try {
    if (body.action === "key") {
      if (typeof body.apiKey !== "string") {
        return NextResponse.json({ error: "No key given." }, { status: 400 });
      }
      await setTranslationKey(body.apiKey);
      return NextResponse.json({ ok: true, ...(await translationKeyStatus()) });
    }
    if (body.action === "picker") {
      if (typeof body.on !== "boolean") {
        return NextResponse.json({ error: "On or off?" }, { status: 400 });
      }
      await setPickerEnabled(body.on);
      return NextResponse.json({ ok: true, ...(await translationKeyStatus()) });
    }
    if (body.action === "sync") {
      return NextResponse.json({ ok: true, ...(await syncSupportedLanguages()) });
    }
    if (!body.code) return NextResponse.json({ error: "Which language?" }, { status: 400 });
    if (typeof body.isEnabled === "boolean") {
      await setLocaleEnabled(body.code, body.isEnabled);
    }
    if (typeof body.sortOrder === "number") {
      await setLocaleOrder(body.code, body.sortOrder);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    // The adapter's errors name the cause — a missing key, a disabled
    // API, a billing problem. A 500 would lose the only useful part.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "That didn't work." },
      { status: 400 },
    );
  }
}
