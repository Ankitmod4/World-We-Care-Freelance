/**
 * /api/user/auth/refresh-verified — re-check the row and re-issue the
 * "email confirmed" claim the middleware reads.
 *
 * This exists because Next will not let a page render write a cookie.
 * The two moments where somebody has just become verified — the
 * confirmation screen, and the gate polling in the background — are
 * both page renders, so both come through here instead.
 *
 * It is also the repair path. Anybody already signed in when this
 * shipped has no claim cookie, and every verified member who lands on
 * the gate gets one here and carries on. Same for a browser that
 * cleared its cookies, and for someone who confirmed on their phone
 * and is still sitting on the gate at their desk.
 *
 * Reads the database every time, deliberately. It is one indexed
 * lookup, and the alternative is trusting a cookie about whether a
 * cookie should be trusted.
 *
 * GET redirects (so it can be a link in an email confirmation page);
 * POST answers JSON (so the gate can ask without navigating).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, setVerifiedCookie } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

/**
 * Same-site paths only. `?next=https://elsewhere/` here would be an
 * open redirect on a URL we put in an email, which is the single best
 * place an attacker could hope to have one. "//evil.com" is a
 * protocol-relative URL the browser treats as another origin, and
 * "/\evil.com" is the same trick with a backslash.
 */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

async function refresh(): Promise<boolean> {
  const user = await getSessionUser();
  if (!user || !user.emailVerifiedAt) return false;
  await setVerifiedCookie(user.id);
  return true;
}

export async function GET(request: NextRequest) {
  const verified = await refresh();
  const target = verified
    ? safeNext(request.nextUrl.searchParams.get("next"))
    : "/verify-email";

  /*
   * A RELATIVE Location header, deliberately.
   *
   * `NextResponse.redirect` demands an absolute URL, and the only
   * origin available to build one is whatever the Host header says —
   * which behind `proxy_pass http://localhost:3000` is
   * "localhost:3000" unless nginx is told otherwise. That is how
   * confirming an email ended up bouncing people at a machine that
   * isn't theirs.
   *
   * RFC 7231 has allowed a relative Location since 2014 and every
   * browser resolves it against the request URL, so this lands on the
   * domain the person is actually browsing — no header to trust, no
   * environment variable required, nothing to misconfigure.
   */
  return new NextResponse(null, {
    status: 303,
    headers: { Location: target, "Cache-Control": "no-store" },
  });
}

export async function POST() {
  const verified = await refresh();
  return NextResponse.json({ verified });
}
