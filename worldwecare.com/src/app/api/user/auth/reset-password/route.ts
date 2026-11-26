/**
 * POST /api/user/auth/reset-password
 *
 * Consumes a reset token and sets a new password.
 *
 * The token is checked before the password is looked at, and
 * `consumeToken` marks it used inside a race-safe UPDATE — two
 * requests carrying the same token cannot both succeed. It is a bearer
 * credential with a ten-minute life, so it gets exactly one use.
 *
 * The new password goes through the same rules module the signup form
 * and endpoint use. A reset is not a back door to a weaker password.
 *
 * NOT SIGNED IN AFTERWARDS, on purpose. Whoever completes this proved
 * they can read the mailbox; making them type the new password once
 * more proves they know it, and means a reset link read over someone's
 * shoulder does not immediately become a live session.
 *
 * AND EVERY OTHER DEVICE IS SIGNED OUT. Half the reason people reset a
 * password is that someone else has it, and a reset that leaves the
 * intruder's session running solves nothing. Stamping
 * `sessionsValidFrom` invalidates every cookie issued before this
 * moment — the phone left at an old address included.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { confirmError, passwordError } from "@/lib/signup-rules";
import { consumeToken, sendPasswordChangedEmail } from "@/lib/verification";
import { logUserActivity } from "@/lib/user-activity";
import { appBaseUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    token?: unknown;
    password?: unknown;
    confirm?: unknown;
  };

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const confirm = typeof body.confirm === "string" ? body.confirm : "";

  const problem = passwordError(password) ?? confirmError(password, confirm);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const consumed = await consumeToken(token, "PASSWORD_RESET");
  if (!consumed.ok || !consumed.userId) {
    return NextResponse.json(
      { error: consumed.error ?? "Invalid or expired link." },
      { status: 400 },
    );
  }

  const user = await prisma.user
    .findUnique({
      where: { id: consumed.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        isActive: true,
        bannedAt: true,
      },
    })
    .catch(() => null);

  if (!user || !user.isActive || user.bannedAt) {
    return NextResponse.json(
      { error: "This account can't be reset. Get in touch with us." },
      { status: 403 },
    );
  }

  const passwordHash = await hashPassword(password);
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        // Same write as the password itself, so there is no window in
        // which the password has changed but the old sessions are
        // still live.
        sessionsValidFrom: new Date(),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Couldn't change your password. Please try again." },
      { status: 500 },
    );
  }

  // Any other reset link for this account dies with the change — a
  // second link minted before this one was used must not still work.
  await prisma.verificationToken
    .updateMany({
      where: { userId: user.id, purpose: "PASSWORD_RESET", usedAt: null },
      data: { usedAt: new Date() },
    })
    .catch(() => {});

  await logUserActivity({
    userId: user.id,
    type: "PASSWORD_CHANGED",
    message: "Password reset via email link.",
  }).catch(() => {});

  // The change already happened. This mail is how the real owner finds
  // out if it wasn't them, so it is sent regardless — but a send
  // failure must not undo a password the person now believes is theirs.
  const appUrl = appBaseUrl(request);
  void sendPasswordChangedEmail(user, appUrl).catch(() => {});

  return NextResponse.json({ ok: true });
}
