/**
 * POST /api/admin/auth/login
 *
 * Body: { email, password }
 * On success: sets the wwc-admin-session cookie and returns 200 { ok }
 * On failure: 401 with a generic error message (never distinguish
 *             "no such user" from "wrong password" — that leaks
 *             which emails have accounts).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { setAdminCookie } from "@/lib/admin-auth";

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

  const admin = await prisma.adminUser
    .findUnique({ where: { email } })
    .catch(() => null);

  // Generic error — no user existence leak. Also run the bcrypt
  // compare even when the row is missing so response time doesn't
  // give away whether the email exists (timing side-channel).
  if (!admin || !admin.isActive) {
    // Fake compare against a known hash to keep timings stable.
    await verifyPassword(
      password,
      "$2a$10$abcdefghijklmnopqrstuv0000000000000000000000000000000000",
    );
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  const ok = await verifyPassword(password, admin.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  // Best-effort last-login timestamp. Failure to update shouldn't
  // block the login — the write is analytics, not auth.
  await prisma.adminUser
    .update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } })
    .catch(() => null);

  await setAdminCookie(admin.id);
  return NextResponse.json({ ok: true });
}
