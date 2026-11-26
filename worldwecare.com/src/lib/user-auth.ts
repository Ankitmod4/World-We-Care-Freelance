/**
 * Frontend-user session helpers. Mirror of admin-auth.ts but reads
 * the user cookie, loads from the User table, and uses the user
 * signing secret. Keeping these two files independent means an
 * accidental import swap can't collapse the two sessions into one.
 */

import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "./db";
import {
  USER_COOKIE,
  USER_VERIFIED_COOKIE,
  cookieOptions,
  issueToken,
  verifyTokenDetailed,
} from "./session";
import { parseAppearanceMode, parseTone, type AppearanceMode } from "./theming";

export interface UserSession {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerifiedAt: string | null;
  /**
   * Appearance travels on the session, not on a separate fetch.
   *
   * Every signed-in page already awaits this call before it renders
   * anything, and `ShellViewer` is structurally this object — so
   * putting the two fields here is what lets all thirty-odd pages
   * that mount `<SiteShell viewer={viewer}>` theme themselves without
   * a single one of them being edited. It also means the theme is
   * known during SSR, which is the whole reason there is no flash of
   * the wrong palette on first paint.
   */
  colorThemeId: string | null;
  appearanceMode: AppearanceMode;
  /** 0 lightest … 4 darkest; see the tone note in @/lib/theming. */
  brandTone: number;
}

export async function setUserCookie(userId: string): Promise<void> {
  const store = await cookies();
  const token = await issueToken(USER_COOKIE, userId);
  store.set(USER_COOKIE.name, token, cookieOptions());
}

/**
 * Mint the "email confirmed" claim the middleware reads.
 *
 * ONLY CALLABLE FROM A ROUTE HANDLER. Next refuses cookie writes
 * during a page render, which is why the two places that need to set
 * this after a page load — the gate and the confirmation screen — both
 * go through /api/user/auth/refresh-verified rather than doing it
 * inline.
 */
export async function setVerifiedCookie(userId: string): Promise<void> {
  const store = await cookies();
  const token = await issueToken(USER_VERIFIED_COOKIE, userId);
  store.set(USER_VERIFIED_COOKIE.name, token, cookieOptions());
}

export async function clearVerifiedCookie(): Promise<void> {
  const store = await cookies();
  store.set(USER_VERIFIED_COOKIE.name, "", { ...cookieOptions(), maxAge: 0 });
}

export async function clearUserCookie(): Promise<void> {
  const store = await cookies();
  store.set(USER_COOKIE.name, "", { ...cookieOptions(), maxAge: 0 });
  // Both, always. A stale claim left behind would be handed to the
  // next person who signs in on this browser.
  store.set(USER_VERIFIED_COOKIE.name, "", { ...cookieOptions(), maxAge: 0 });
}

/**
 * The signed-in member, CONFIRMED EMAIL OR NOT.
 *
 * Two callers, and they are the only two there should ever be: the
 * verification gate itself, and the endpoints that exist to get
 * someone through it. Everything else in the app wants
 * `getCurrentUser`.
 */
export async function getSessionUser(): Promise<UserSession | null> {
  const store = await cookies();
  const token = store.get(USER_COOKIE.name)?.value;
  const verified = await verifyTokenDetailed(USER_COOKIE, token);
  if (!verified) return null;

  const row = await prisma.user
    .findUnique({
      where: { id: verified.subjectId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        isActive: true,
        bannedAt: true,
        emailVerifiedAt: true,
        sessionsValidFrom: true,
        colorThemeId: true,
        appearanceMode: true,
        brandTone: true,
      },
    })
    .catch(() => null);
  // A banned or deactivated user hydrates as null so downstream
  // pages treat them as logged-out until they hit the login flow
  // and get the proper error message.
  if (!row || !row.isActive || row.bannedAt) return null;

  // Revocation. A password change stamps `sessionsValidFrom`, which
  // kills every cookie minted before it — including the ones on
  // devices the person no longer has. This is the whole reason the
  // token carries its issue time.
  //
  // The comparison is `<`, not `<=`: a cookie issued in the same
  // millisecond as the revocation is the one that just replaced it.
  if (row.sessionsValidFrom && verified.issuedAt < row.sessionsValidFrom.getTime()) {
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
    colorThemeId: row.colorThemeId,
    // Null in the column means "never chose", which resolves to the
    // app default — see DEFAULT_APPEARANCE_MODE. `parseAppearanceMode`
    // is the only thing that decides that, including for a value some
    // future migration leaves behind that no longer means anything.
    appearanceMode: parseAppearanceMode(row.appearanceMode),
    brandTone: parseTone(row.brandTone),
  };
}

/**
 * The signed-in member — and unverified accounts do not count.
 *
 * THIS IS THE GATE, and it is here rather than in middleware on
 * purpose. Fifty-odd pages and seventeen API routes already call this
 * function to find out who is asking; making it answer "nobody" for an
 * unconfirmed account closes every one of them at once, and closes the
 * ones written next year too. Middleware can only redirect — and it
 * cannot reach the database, so it can only ever act on a claim in a
 * cookie. This reads the row.
 *
 * The effect on a page is the same as being signed out: a protected
 * page bounces to /login, which sends them on to /verify-email. The
 * middleware exists to make that first hop direct rather than
 * scenic — not to be the thing that stops them.
 */
export async function getCurrentUser(): Promise<UserSession | null> {
  const session = await getSessionUser();
  if (!session) return null;
  if (!session.emailVerifiedAt) return null;
  return session;
}

export async function requireUser(
  _request: NextRequest,
): Promise<UserSession | NextResponse> {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}
