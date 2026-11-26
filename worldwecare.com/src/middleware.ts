/**
 * Edge middleware.
 *
 * Two jobs, and neither of them is the real security boundary:
 *
 *   1. /admin/* needs a valid admin cookie.
 *   2. A signed-in member whose email is not confirmed gets sent to
 *      /verify-email instead of wherever they were going.
 *
 * NO DATABASE FROM HERE — edge runtime, no Prisma. So both checks are
 * signature checks on cookies, and both are backed by a real row-level
 * check further in: `getCurrentAdmin()` for the first, and
 * `getCurrentUser()` for the second, which returns null for an
 * unconfirmed account and so shuts every page and API route whether
 * this file runs or not.
 *
 * What this adds is the redirect. Without it an unverified member gets
 * treated as signed out, bounces to /login, and has to work out for
 * themselves why. With it they land on the page that explains.
 *
 * Sessions stay strictly separate: presenting a user cookie to /admin
 * does nothing, and an admin cookie is not a member session.
 */

import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, USER_COOKIE, USER_VERIFIED_COOKIE, verifyToken } from "./lib/session";

/**
 * Paths a member with an unconfirmed email may still reach.
 *
 * Everything here is either part of getting verified, part of leaving,
 * or something we would show a stranger anyway. Prefix matches, so
 * "/verify" also covers "/verify?token=…".
 *
 * `/api/user/auth` is open as a whole because every endpoint under it
 * is either the way out of this state (resend, refresh-verified,
 * pending-email) or the way out of the account (logout).
 */
const GATE_EXEMPT = [
  "/verify-email",
  "/verify",
  "/verify-email-change",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/terms",
  "/privacy",
  "/contact",
  "/api/user/auth",
  // Public data, and public means public. The country list is fetched
  // by the signup form, which is itself exempt — gating the data it
  // needs while letting the page render is the worst of both: the form
  // appears, and its country picker is empty with nothing to say why.
  "/api/public",
  // The admin area runs on its own session and its own check above.
  "/admin",
  "/api/admin",
  // Stripe posts here with no cookies at all. Anything that redirects
  // an unverified user would turn a webhook into a 3xx, Stripe would
  // record a delivery failure and retry for three days, and payments
  // would silently never be credited.
  "/api/webhooks",
];

function exempt(pathname: string): boolean {
  return GATE_EXEMPT.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`),
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  /* ── 1. admin ──────────────────────────────────────────────── */

  // /admin/login is public — the login form itself needs to render
  // for someone who isn't yet authenticated.
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const token = req.cookies.get(ADMIN_COOKIE.name)?.value;
    // verifyToken is async — SubtleCrypto returns a promise even for
    // synchronous-looking HMAC work in edge runtime.
    const adminId = await verifyToken(ADMIN_COOKIE, token);
    if (!adminId) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      // Preserve the intended destination so the login handler can
      // bounce the user back after auth completes.
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  /* ── 2. unconfirmed members ────────────────────────────────── */

  if (exempt(pathname)) return NextResponse.next();

  const sessionToken = req.cookies.get(USER_COOKIE.name)?.value;
  // No session at all is not our business. A stranger reading the site
  // without an account is the thing this place is built around — see
  // "Reading costs nothing" on the landing page — and gating them
  // would be a much bigger change than the one being made here.
  if (!sessionToken) return NextResponse.next();

  const userId = await verifyToken(USER_COOKIE, sessionToken);
  if (!userId) return NextResponse.next();

  const claim = await verifyToken(
    USER_VERIFIED_COOKIE,
    req.cookies.get(USER_VERIFIED_COOKIE.name)?.value,
  );

  // Must be the SAME id. A claim for somebody else — a leftover from
  // the last person to sign in on this browser — is not a claim for
  // you. A missing claim is treated as unverified, which is why
  // deleting the cookie gains nothing.
  if (claim && claim === userId) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Confirm your email address first.", needsVerification: true },
      { status: 403 },
    );
  }

  const url = req.nextUrl.clone();
  url.pathname = "/verify-email";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    /*
     * Everything except the things that are not pages: Next's own
     * build output, the favicon, uploaded media, and anything with a
     * static file extension.
     *
     * The cost of running this widely is two HMAC verifications on
     * requests that carry a session cookie and none at all on requests
     * that don't — which is every request from a signed-out visitor
     * and every request for an asset.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|uploads/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|json|woff|woff2|ttf)$).*)",
  ],
};
