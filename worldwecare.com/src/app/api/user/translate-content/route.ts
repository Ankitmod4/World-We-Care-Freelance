/**
 * POST /api/user/translate-content — { refs: [{kind, id, field}] }
 *
 * IDS ONLY, NEVER TEXT. The body carries references; the server
 * fetches the text itself and only for rows that are already
 * readable. A route that translated whatever string it was posted
 * would be an open translation proxy billed to the platform's Google
 * key, findable by anyone.
 *
 * ── IT WORKS SIGNED OUT, AND THAT WAS A REAL BUG ──
 *
 * This used to require a session. Every page it serves — articles,
 * places, campaigns, the walls — renders for a signed-out visitor on
 * purpose; "reading costs nothing" is on the landing page and is the
 * thing the site is built around. So a visitor could pick a language,
 * watch the interface change around them, and see every headline,
 * category and card stay in English, with nothing anywhere saying
 * why. The session was doing no work that the id-only design and the
 * loaders' own status filters were not already doing.
 *
 * What the session DOES still decide is `notification`, which is
 * addressed to one person: signed out, that kind resolves to nothing
 * because there is no viewer to match against.
 *
 * ── THE SPEND IS WHAT NEEDS GUARDING, NOT THE READER ──
 *
 * Every cache miss costs money, so an anonymous caller is rate
 * limited per IP rather than turned away. The limit is generous
 * enough that real browsing never meets it — a page is one request —
 * and small enough that a script cannot sit on it.
 *
 * THE LOCALE COMES FROM THE COOKIE, not the body, so nobody can make
 * the platform pay to translate into a language nobody has enabled.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { LOCALE_COOKIE } from "@/lib/i18n-core";
import { resolveLocale } from "@/lib/i18n";
import { isContentKind, translateContent, type ContentRef } from "@/lib/content-translate";

export const dynamic = "force-dynamic";

/** A page is one request; a scroll through a long feed is a handful. */
const ANON_PER_MINUTE = 60;

export async function POST(request: NextRequest) {
  const viewer = await getCurrentUser().catch(() => null);

  if (!viewer) {
    const ip = clientIp(request) ?? "unknown";
    const hit = rateLimit(`translate-content:${ip}`, ANON_PER_MINUTE, 60_000);
    if (!hit.ok) {
      return NextResponse.json(
        { error: "Too many requests.", retryAfter: hit.retryAfter },
        { status: 429 },
      );
    }
  }

  const body = (await request.json().catch(() => ({}))) as { refs?: unknown };
  if (!Array.isArray(body.refs)) {
    return NextResponse.json({ error: "refs required" }, { status: 400 });
  }

  const refs: ContentRef[] = [];
  for (const raw of body.refs.slice(0, 60)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (!isContentKind(r.kind)) continue;
    if (typeof r.id !== "string" || !r.id) continue;
    if (typeof r.field !== "string" || !r.field) continue;
    refs.push({ kind: r.kind, id: r.id, field: r.field });
  }

  const locale = await resolveLocale(request.cookies.get(LOCALE_COOKIE)?.value);
  try {
    const { values, partial } = await translateContent(refs, locale.code, viewer?.id ?? null);
    return NextResponse.json({ locale: locale.code, values, partial });
  } catch (err) {
    /*
       A THROW HERE IS ALMOST ALWAYS THE MISSING TABLE.

       `content_translations` arrives with a schema change, and a
       server that never ran it throws on every lookup. The reader
       still gets their originals — the browser treats a failure as
       "no translation" — but the message goes into the server log
       with the fix in it, instead of the whole feature being silently
       dead.
    */
    console.error("[translate-content]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error && /content_translations|P2021|doesn't exist/i.test(err.message)
            ? "The content_translations table is missing — run `npx prisma db push` on the server."
            : "Could not translate.",
      },
      { status: 500 },
    );
  }
}
