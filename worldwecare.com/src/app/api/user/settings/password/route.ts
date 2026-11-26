/**
 * POST — change the password from inside the account.
 *
 * The change revokes every session, including the cookie sitting in
 * the browser that just made this request. So a fresh one is issued
 * immediately afterwards: other devices drop, this one stays. Without
 * that re-issue the person would be logged out by their own action,
 * which reads as a bug however correct it is.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, setUserCookie } from "@/lib/user-auth";
import { changePassword } from "@/lib/account";
import { sendPasswordChangedEmail } from "@/lib/verification";
import { logUserActivity } from "@/lib/user-activity";
import { prisma } from "@/lib/db";
import { appBaseUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    currentPassword?: unknown;
    password?: unknown;
    confirm?: unknown;
  };

  try {
    await changePassword({
      userId: auth.id,
      currentPassword:
        typeof body.currentPassword === "string" ? body.currentPassword : "",
      password: typeof body.password === "string" ? body.password : "",
      confirm: typeof body.confirm === "string" ? body.confirm : "",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't change it" },
      { status: 400 },
    );
  }

  // Mint a cookie stamped after the cut-off, so this device survives
  // the revocation it just caused.
  await setUserCookie(auth.id);

  await logUserActivity({
    userId: auth.id,
    type: "PASSWORD_CHANGED",
    message: "Password changed from settings.",
  }).catch(() => {});

  const user = await prisma.user
    .findUnique({
      where: { id: auth.id },
      select: { id: true, email: true, displayName: true },
    })
    .catch(() => null);
  if (user) {
    const appUrl = appBaseUrl(request);
    void sendPasswordChangedEmail(user, appUrl).catch(() => {});
  }

  return NextResponse.json({ ok: true, otherDevicesSignedOut: true });
}
