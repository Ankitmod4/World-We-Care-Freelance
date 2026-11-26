/**
 * POST /api/user/auth/forgot-password
 *
 * THIS ENDPOINT ALWAYS GIVES THE SAME ANSWER. Whether the address is
 * registered, unregistered, banned, or throttled, the response body,
 * the status code and the wording are identical. Anything else turns
 * this into a membership oracle: point a script at it with a list of
 * addresses and it tells you which of your users are on a recovery
 * and mental-health site. For this particular site that is not a
 * theoretical harm.
 *
 * That constraint drives two decisions that look odd otherwise:
 *
 *  • The send is fired without awaiting it. Awaiting would make a hit
 *    measurably slower than a miss, and a stopwatch is as good an
 *    oracle as an error message.
 *  • The rate limit is silent. A 429 for known addresses only would
 *    leak exactly what the generic message is hiding, so a throttled
 *    request is quietly dropped and still answered "check your inbox".
 *
 * (Signup deliberately does the opposite and admits an address is
 * taken — there the person is already telling us the address, and the
 * usable alternative is worse. Here they are not.)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { emailError } from "@/lib/signup-rules";
import { sendPasswordResetEmail } from "@/lib/verification";
import { appBaseUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

/** One request per address per minute. Enough to stop a mail flood. */
const THROTTLE_MS = 60 * 1000;

const SAME_ANSWER = {
  ok: true,
  message:
    "If that email is registered, a reset link is on its way. It expires in 10 minutes.",
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  // A malformed address is the one thing worth saying out loud: it
  // reveals nothing about who is registered, and silently "sending" to
  // "nigel" helps nobody.
  const malformed = emailError(email);
  if (malformed) {
    return NextResponse.json({ error: malformed }, { status: 400 });
  }

  const user = await prisma.user
    .findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        displayName: true,
        isActive: true,
        bannedAt: true,
      },
    })
    .catch(() => null);

  if (user && user.isActive && !user.bannedAt) {
    const appUrl = appBaseUrl(request);

    // Not awaited — see the header. Failures land in the email log.
    void dispatch(user, appUrl).catch(() => {});
  }

  return NextResponse.json(SAME_ANSWER);
}

async function dispatch(
  user: { id: string; email: string; displayName: string },
  appUrl: string,
): Promise<void> {
  const recent = await prisma.verificationToken.findFirst({
    where: { userId: user.id, purpose: "PASSWORD_RESET" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < THROTTLE_MS) return;

  await sendPasswordResetEmail(user, appUrl);
}
