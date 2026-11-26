/**
 * POST /api/user/auth/resend-verification
 *
 * Regenerates the email-confirm token for the signed-in user and
 * sends a fresh email. Requires an active user session — no way to
 * request a resend for an arbitrary email address (that would let
 * anyone spam any address on the platform).
 *
 * Rate-limit is soft (once per 30s per user) to prevent someone
 * hitting the button 100 times and burning their Resend quota.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/user-auth";
import { sendConfirmationEmail } from "@/lib/verification";
import { appBaseUrl } from "@/lib/app-url";

const RATE_LIMIT_SECONDS = 30;

export async function POST(request: Request) {
  // getSessionUser, not getCurrentUser: this endpoint's entire
  // purpose is to serve an account that is NOT yet verified, and the
  // gated one hands back null for exactly those.
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      displayName: true,
      emailVerifiedAt: true,
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Account missing" }, { status: 404 });
  }
  if (row.emailVerifiedAt) {
    return NextResponse.json({
      ok: true,
      alreadyVerified: true,
    });
  }

  // Simple rate limit — check the most recent unused confirm token.
  const recent = await prisma.verificationToken.findFirst({
    where: {
      userId: row.id,
      purpose: "EMAIL_CONFIRM",
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (
    recent &&
    Date.now() - recent.createdAt.getTime() < RATE_LIMIT_SECONDS * 1000
  ) {
    const secondsLeft = Math.max(
      1,
      RATE_LIMIT_SECONDS -
        Math.floor((Date.now() - recent.createdAt.getTime()) / 1000),
    );
    return NextResponse.json(
      { error: `Please wait ${secondsLeft}s before requesting another email.` },
      { status: 429 },
    );
  }

  const appUrl = appBaseUrl(request);
  const result = await sendConfirmationEmail(row, appUrl);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Send failed" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
