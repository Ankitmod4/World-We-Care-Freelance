/**
 * POST /api/user/auth/login — community-side login.
 * Sets the wwc-user-session cookie (distinct from wwc-admin-session).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { setUserCookie, setVerifiedCookie } from "@/lib/user-auth";
import { logUserActivity } from "@/lib/user-activity";

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } }).catch(() => null);
  if (!user) {
    // Constant-time compare against a fake hash — same trick as
    // admin-login so response timing doesn't leak account existence.
    await verifyPassword(
      password,
      "$2a$10$abcdefghijklmnopqrstuv0000000000000000000000000000000000",
    );
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  // Distinguish banned vs deactivated vs bad-password so the admin
  // action leaves the user with a clear message, not a generic
  // "invalid credentials". Order matters: check ban FIRST so a
  // banned user's bad password doesn't reveal password status.
  if (user.bannedAt) {
    await logUserActivity({
      userId: user.id,
      type: "SIGN_IN_FAILED",
      message: "Sign-in blocked — account is banned.",
    });
    return NextResponse.json(
      { error: "This account has been banned. Contact support if you believe this is a mistake." },
      { status: 403 },
    );
  }
  if (!user.isActive) {
    await logUserActivity({
      userId: user.id,
      type: "SIGN_IN_FAILED",
      message: "Sign-in blocked — account is deactivated.",
    });
    return NextResponse.json(
      { error: "This account has been deactivated." },
      { status: 403 },
    );
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await logUserActivity({
      userId: user.id,
      type: "SIGN_IN_FAILED",
      message: "Wrong password.",
    });
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  await prisma.user
    .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    .catch(() => null);
  await logUserActivity({
    userId: user.id,
    type: "SIGNED_IN",
    message: "Signed in.",
  });

  await setUserCookie(user.id);
  // Mint the middleware's claim here, where a cookie write is legal.
  // An unconfirmed account gets no claim and meets the gate on the
  // next page it asks for.
  if (user.emailVerifiedAt) await setVerifiedCookie(user.id);
  return NextResponse.json({ ok: true });
}
