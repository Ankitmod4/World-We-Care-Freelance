/**
 * POST /api/user/auth/pending-email — change the address a confirmation
 * link is going to, from inside the verification gate.
 *
 * WHY THIS IS NOT JUST /api/user/settings/email. That one is behind
 * `requireUser`, which now refuses unverified accounts — so the moment
 * the gate went up, somebody who typed "gmial.com" was locked out of
 * their own account permanently, with the one screen that could fix it
 * on the far side of the wall.
 *
 * The password is still required, exactly as in settings: this changes
 * where a confirmation link is sent, so it must not be doable by
 * whoever happens to be holding an open laptop.
 *
 * Confirming the new address sets `emailVerifiedAt` — the address is
 * proven by having received the link — so this doubles as the way out
 * of the gate for anyone who mistyped.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/user-auth";
import { requestEmailChange } from "@/lib/account";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { appBaseUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

const PER_IP = 10;
const WINDOW_MS = 60 * 60_000;

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }
  // Already verified? Then this belongs in settings, with the rest of
  // the account controls.
  if (user.emailVerifiedAt) {
    return NextResponse.json(
      { error: "Your email is already confirmed. Change it in Settings." },
      { status: 400 },
    );
  }

  const ip = clientIp(request);
  if (ip) {
    const limit = rateLimit(`pending-email:${ip}`, PER_IP, WINDOW_MS);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many attempts. Please try later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: unknown;
    currentPassword?: unknown;
  };

  try {
    const result = await requestEmailChange({
      userId: user.id,
      newEmail: typeof body.email === "string" ? body.email : "",
      currentPassword:
        typeof body.currentPassword === "string" ? body.currentPassword : "",
      appUrl: appBaseUrl(request),
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't do that" },
      { status: 400 },
    );
  }
}
