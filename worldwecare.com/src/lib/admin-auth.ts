/**
 * Admin session helpers. Read + verify the admin cookie, hydrate the
 * AdminUser row, and short-circuit inactive accounts.
 *
 * Kept SEPARATE from user-auth so nothing in the frontend layer can
 * accidentally elevate a user session to admin. The two libraries
 * import the same `session.ts` primitives but pass in the admin
 * cookie config and never overlap.
 */

import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "./db";
import { ADMIN_COOKIE, cookieOptions, issueToken, verifyToken } from "./session";

/** Public shape returned from getCurrentAdmin — never includes the
 *  password hash so a stray console.log can't leak it. */
export interface AdminSession {
  id: string;
  email: string;
  displayName: string;
  role: "OWNER" | "ADMIN" | "MODERATOR";
}

/** Set the admin cookie (call after a successful login). */
export async function setAdminCookie(adminId: string): Promise<void> {
  const store = await cookies();
  const token = await issueToken(ADMIN_COOKIE, adminId);
  store.set(ADMIN_COOKIE.name, token, cookieOptions());
}

/** Clear the admin cookie (call on logout). */
export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE.name, "", { ...cookieOptions(), maxAge: 0 });
}

/** Read the cookie, verify signature + age, load the row. Returns
 *  null when the visitor isn't authenticated (no cookie, bad
 *  signature, expired, deleted account, deactivated account). Never
 *  throws — callers can treat null as "not signed in". */
export async function getCurrentAdmin(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE.name)?.value;
  const adminId = await verifyToken(ADMIN_COOKIE, token);
  if (!adminId) return null;

  const row = await prisma.adminUser
    .findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
      },
    })
    .catch(() => null);
  if (!row || !row.isActive) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
  };
}

/**
 * Owner-only gate for the admin-account endpoints.
 *
 * `requireAdmin` proves you are SOME admin. It says nothing about
 * role, and the admin-management routes were relying on it alone —
 * so any MODERATOR could PUT their own record with role "OWNER",
 * reset an owner's password and sign in as them, or mint a fresh
 * owner outright. The role column existed and was enforced on lesser
 * things (permanently deleting a post, editing stream settings); the
 * one surface where it mattered most had no check at all.
 *
 * Returns a 403 to return from the handler, or null to proceed.
 */
export function requireOwner(auth: AdminSession): NextResponse | null {
  if (auth.role === "OWNER") return null;
  return NextResponse.json(
    { error: "Only an owner can manage admin accounts." },
    { status: 403 },
  );
}

/**
 * Like `requireAdmin`, but for the money.
 *
 * `requireAdmin` proves SOME admin, not which one — deliberately, and
 * that is right for most of the admin area. It is not right here.
 * MODERATOR is the lowest-trust tier, handed out for comment
 * moderation, and without this a moderator could:
 *
 *   - replace the Stripe secret key with their own and collect every
 *     subsequent donation,
 *   - mark real withdrawal requests PAID without sending any money,
 *   - set the payout fee to 100%,
 *   - and read every member's decrypted bank details out of the
 *     payout queue.
 *
 * The rest of the sensitive tier already gates on role this way
 * (deleting a post, changing stream settings). The payment routes
 * were the ones that didn't.
 *
 * `level: "owner"` is stricter still, for the Stripe credentials
 * themselves — it matches what the settings page already shows, so
 * the API stops being more permissive than its own UI.
 */
export async function requireMoneyAdmin(
  request: NextRequest,
  level: "admin" | "owner" = "admin",
): Promise<AdminSession | NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  if (level === "owner" && auth.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only an owner can change the payment credentials." },
      { status: 403 },
    );
  }
  if (auth.role === "MODERATOR") {
    return NextResponse.json(
      { error: "Moderators can't work with payments or payouts." },
      { status: 403 },
    );
  }
  return auth;
}

/** Route handler helper. Returns either the session (proceed) or a
 *  401 NextResponse (return immediately from the handler). */
export async function requireAdmin(
  _request: NextRequest,
): Promise<AdminSession | NextResponse> {
  const session = await getCurrentAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}
