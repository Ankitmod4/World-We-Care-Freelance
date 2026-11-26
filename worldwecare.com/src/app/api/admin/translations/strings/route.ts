/**
 * GET  — the catalogue for one language, filtered.
 * POST — save one translation, or mark one reviewed.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listStrings, markReviewed, saveTranslation } from "@/lib/translations-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const sp = request.nextUrl.searchParams;
  const locale = sp.get("locale");
  if (!locale) return NextResponse.json({ error: "Which language?" }, { status: 400 });

  return NextResponse.json(
    await listStrings({
      locale,
      filter: (sp.get("filter") as "all" | "missing" | "machine" | "reviewed" | "stale") ?? "all",
      q: sp.get("q") ?? undefined,
      take: Number(sp.get("take")) || undefined,
      skip: Number(sp.get("skip")) || undefined,
    }),
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => ({}))) as {
    stringId?: string;
    locale?: string;
    value?: string;
    action?: string;
  };
  if (!body.stringId || !body.locale) {
    return NextResponse.json({ error: "Which string, and which language?" }, { status: 400 });
  }

  try {
    if (body.action === "review") {
      await markReviewed(body.stringId, body.locale, auth.id);
    } else {
      await saveTranslation(body.stringId, body.locale, String(body.value ?? ""), auth.id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save." },
      { status: 400 },
    );
  }
}
