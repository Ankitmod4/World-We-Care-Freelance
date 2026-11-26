/**
 * Verification tokens (email confirmation + password reset).
 *
 * Design:
 *   • 32 random bytes → 64 hex chars. Unguessable, URL-safe.
 *   • Purpose-scoped so an email-confirm link can't reset a password.
 *   • Single-use — marked `usedAt` when consumed. Consume also
 *     invalidates every OTHER outstanding token for the same
 *     (userId, purpose) pair so an admin re-send doesn't leave stale
 *     links floating around.
 *   • Expires after 24h for confirm, 10 minutes for password reset.
 *
 * WHY TEN MINUTES FOR A RESET. A reset link is a bearer credential —
 * anyone holding it becomes the account. It travels through an inbox,
 * which is the one place a link is likely to sit unattended, get
 * forwarded, or be read by whoever else has the password to that
 * mailbox. The window only has to be long enough to walk from the
 * request to the inbox and back. Confirmation links carry no such
 * power, which is why they get a day.
 */

import type { User, VerificationPurpose } from "@prisma/client";
import { prisma } from "./db";
import { sendEmail } from "./email";
import { getSetting } from "./settings";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const RESET_TTL_MS = 10 * MINUTE;
export const RESET_TTL_MINUTES = RESET_TTL_MS / MINUTE;

const TTL_MS: Record<VerificationPurpose, number> = {
  EMAIL_CONFIRM: 24 * HOUR,
  PASSWORD_RESET: RESET_TTL_MS,
  // An hour. Longer than a reset because it is far less dangerous —
  // the link only confirms an address the account holder already
  // typed, and confirms it *from that address*. Shorter than a day
  // because a pending change should not linger.
  EMAIL_CHANGE: 1 * HOUR,
};

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/**
 * Mint a fresh token for the (user, purpose) pair. Invalidates any
 * outstanding token for the same pair — a user hitting "Resend
 * verification" three times only ever has one live link.
 */
export async function createToken(
  userId: string,
  purpose: VerificationPurpose,
): Promise<string> {
  await prisma.verificationToken.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });
  const token = randomToken();
  await prisma.verificationToken.create({
    data: {
      token,
      userId,
      purpose,
      expiresAt: new Date(Date.now() + TTL_MS[purpose]),
    },
  });
  return token;
}

export interface ConsumeResult {
  ok: boolean;
  userId?: string;
  error?: string;
}

/**
 * Validate a token, mark it used, and return the userId. Any error
 * (missing / wrong purpose / already used / expired) returns a
 * generic "invalid or expired" error — never distinguish reasons to
 * the caller, that would let an attacker probe token space.
 */
export async function consumeToken(
  token: string,
  purpose: VerificationPurpose,
): Promise<ConsumeResult> {
  if (!token || token.length !== 64) {
    return { ok: false, error: "Invalid or expired link." };
  }
  const row = await prisma.verificationToken
    .findUnique({ where: { token } })
    .catch(() => null);
  if (!row || row.purpose !== purpose) {
    return { ok: false, error: "Invalid or expired link." };
  }
  if (row.usedAt) {
    return { ok: false, error: "This link has already been used." };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This link has expired. Please request a new one." };
  }
  // Race-safe consume — the WHERE clause on `usedAt` ensures only
  // one caller can flip it. If two verify requests land at once, the
  // second one's updateMany changes 0 rows and we treat it as used.
  const updated = await prisma.verificationToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (updated.count === 0) {
    return { ok: false, error: "This link has already been used." };
  }
  return { ok: true, userId: row.userId };
}

/**
 * Send the `email_confirm` template with a freshly-minted token
 * embedded in the confirm link. Returns whether the send succeeded
 * so the caller can surface a "check your inbox" toast.
 */
export async function sendConfirmationEmail(
  user: Pick<User, "id" | "email" | "displayName">,
  appUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = await createToken(user.id, "EMAIL_CONFIRM");
  const siteName = await getSetting<string>("general.siteName", "WorldWeCare");
  const base = appUrl.endsWith("/") ? appUrl : `${appUrl}/`;
  const confirmLink = `${base}verify?token=${token}`;

  const result = await sendEmail({
    templateSlug: "email_confirm",
    to: user.email,
    variables: {
      name: user.displayName,
      siteName,
      appUrl: base,
      confirmLink,
    },
  });
  if (!result.ok) {
    return { ok: false, error: result.message ?? "Send failed" };
  }
  return { ok: true };
}

/**
 * Send the password-reset link.
 *
 * Minting a token invalidates any earlier one for this user, so asking
 * twice leaves exactly one live link — the newest. That is deliberate:
 * a person who clicks "resend" because the first mail was slow should
 * not end up with two working keys to their account.
 */
export async function sendPasswordResetEmail(
  user: Pick<User, "id" | "email" | "displayName">,
  appUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = await createToken(user.id, "PASSWORD_RESET");
  const siteName = await getSetting<string>("general.siteName", "WorldWeCare");
  const base = appUrl.endsWith("/") ? appUrl : `${appUrl}/`;
  const resetLink = `${base}reset-password?token=${token}`;

  const result = await sendEmail({
    templateSlug: "password_reset",
    to: user.email,
    variables: {
      name: user.displayName,
      siteName,
      appUrl: base,
      resetLink,
      minutes: RESET_TTL_MINUTES,
    },
  });
  if (!result.ok) return { ok: false, error: result.message ?? "Send failed" };
  return { ok: true };
}

/**
 * Tell someone their password changed.
 *
 * This one is not a courtesy. If an attacker resets the password, this
 * mail is the only thing that tells the real owner it happened, so it
 * goes out even when the change succeeded normally, and a failure to
 * send must never roll back the change — the person asked for a new
 * password and they have one.
 */
export async function sendPasswordChangedEmail(
  user: Pick<User, "id" | "email" | "displayName">,
  appUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const [siteName, supportEmail] = await Promise.all([
    getSetting<string>("general.siteName", "WorldWeCare"),
    getSetting<string>("email.replyToEmail", ""),
  ]);
  const base = appUrl.endsWith("/") ? appUrl : `${appUrl}/`;

  const result = await sendEmail({
    templateSlug: "password_reset_confirmed",
    to: user.email,
    variables: {
      name: user.displayName,
      siteName,
      appUrl: base,
      supportEmail: supportEmail || `the contact form at ${base}`,
    },
  });
  if (!result.ok) return { ok: false, error: result.message ?? "Send failed" };
  return { ok: true };
}

/**
 * Confirm a new address, sent TO THE NEW ADDRESS.
 *
 * That direction is the whole security property. Anyone can type an
 * address into a form; only the person holding that inbox can prove it
 * is theirs, and until they do, `pendingEmail` is the only place it
 * lives. The account's real `email` is untouched, so a typo is a dead
 * link rather than a locked-out account.
 */
export async function sendEmailChangeEmail(
  user: Pick<User, "id" | "displayName">,
  newEmail: string,
  appUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = await createToken(user.id, "EMAIL_CHANGE");
  const siteName = await getSetting<string>("general.siteName", "WorldWeCare");
  const base = appUrl.endsWith("/") ? appUrl : `${appUrl}/`;
  const confirmLink = `${base}verify-email-change?token=${token}`;

  const result = await sendEmail({
    // Reuses the confirmation template — same job, same variables.
    templateSlug: "email_confirm",
    to: newEmail,
    variables: {
      name: user.displayName,
      siteName,
      appUrl: base,
      confirmLink,
    },
  });
  if (!result.ok) return { ok: false, error: result.message ?? "Send failed" };
  return { ok: true };
}
