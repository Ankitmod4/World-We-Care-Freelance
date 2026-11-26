/**
 * POST /api/user/auth/signup — community account creation.
 *
 * Every rule comes from `@/lib/signup-rules`, the same module the form
 * imports. The form's validation is a courtesy to whoever is typing;
 * this is the one that counts, because a POST never has to come from
 * the form. They share a module so they cannot drift apart.
 *
 * Two things are checked here that the browser cannot be trusted on:
 *
 *   • the country must be one that actually exists and is active — an
 *     arbitrary string in that column is a foreign key to nothing
 *   • the terms tick must be present in the body; a checkbox is
 *     trivially skipped by anything that isn't the form, and an
 *     acceptance timestamp nobody verified is worthless
 *
 * Emits a friendly "already registered" error when the email is
 * taken. This is a deliberate departure from the login endpoint's
 * "generic error" posture: at signup, the useful UX (telling the
 * person to sign in instead) outweighs the enumeration risk.
 *
 * ── Anti-spam, added after 2,800 scripted registrations ──
 *
 * Three cheap layers, in the order they cost the least to check:
 *
 *   1. A per-IP ceiling. Nobody legitimately opens five accounts from
 *      one address in an hour.
 *   2. A honeypot field the form keeps off-screen. A browser leaves it
 *      empty; something filling every input does not.
 *   3. The arithmetic challenge from `@/lib/captcha`.
 *
 * All three run BEFORE `hashPassword`. Bcrypt is deliberately slow —
 * roughly 100ms of CPU per call — so letting an unverified request
 * reach it turns a signup flood into a way to pin the server. The
 * captcha check is the last thing before it and the first thing that
 * costs anything.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { setUserCookie } from "@/lib/user-auth";
import { logUserActivity } from "@/lib/user-activity";
import { sendConfirmationEmail } from "@/lib/verification";
import { createForAllAdmins } from "@/lib/admin-notifications";
import { spend, verifyChallenge } from "@/lib/captcha";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { appBaseUrl } from "@/lib/app-url";
import {
  countryError,
  emailError,
  nameError,
  passwordError,
  termsError,
} from "@/lib/signup-rules";

/** Accounts one address may create per window. */
const ACCOUNTS_PER_IP = 5;
/** Attempts — including failures — so a wrong-answer loop is bounded too. */
const ATTEMPTS_PER_IP = 25;
const WINDOW_MS = 60 * 60_000;

export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  if (ip) {
    const attempts = rateLimit(`signup:attempt:${ip}`, ATTEMPTS_PER_IP, WINDOW_MS);
    if (!attempts.ok) {
      return NextResponse.json(
        { error: "Too many attempts from this connection. Please try later." },
        { status: 429, headers: { "Retry-After": String(attempts.retryAfter) } },
      );
    }
  }

  let body: {
    email?: unknown;
    password?: unknown;
    displayName?: unknown;
    countryId?: unknown;
    acceptedTerms?: unknown;
    captchaToken?: unknown;
    captchaAnswer?: unknown;
    /** The honeypot. See below — it must arrive empty. */
    website?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const displayName =
    typeof body.displayName === "string" ? body.displayName.trim() : "";
  const countryId =
    typeof body.countryId === "string" && body.countryId.trim()
      ? body.countryId.trim()
      : null;
  const acceptedTerms = body.acceptedTerms === true;

  const problem =
    emailError(email) ??
    passwordError(password) ??
    nameError(displayName) ??
    countryError(countryId) ??
    termsError(acceptedTerms);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  // The honeypot. The form renders this input off-screen with no label
  // and no tab stop, so a person never sees it and a browser never
  // fills it. The error is deliberately recoverable rather than silent:
  // an over-eager password manager could in principle type into it, and
  // a real person hitting that deserves to be told what to do rather
  // than watch the button do nothing.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json(
      { error: "Something in the form didn't look right. Reload the page and try again." },
      { status: 400 },
    );
  }

  const captcha = verifyChallenge(body.captchaToken, body.captchaAnswer);
  if (!captcha.ok) {
    // `newChallenge` tells the form to fetch a fresh sum. Without it a
    // spent or expired token leaves the person stuck on a question
    // that can no longer be right, however carefully they answer it.
    return NextResponse.json(
      { error: captcha.error, newChallenge: captcha.expired === true },
      { status: 400 },
    );
  }

  // The country is a loose FK, so nothing at the database level would
  // stop a made-up id landing in that column. Check it against the
  // countries actually on offer.
  // Unreachable: `countryError` in the chain above has already rejected
  // a missing country. It is here so the type narrows — an assertion
  // would be a lie that stays true only until someone edits the chain.
  if (!countryId) {
    return NextResponse.json({ error: countryError(countryId) }, { status: 400 });
  }

  const country = await prisma.country
    .findFirst({ where: { id: countryId, isActive: true }, select: { id: true } })
    .catch(() => null);
  if (!country) {
    return NextResponse.json(
      { error: "Pick a country from the list." },
      { status: 400 },
    );
  }

  const existing = await prisma.user
    .findUnique({ where: { email }, select: { id: true } })
    .catch(() => null);
  if (existing) {
    return NextResponse.json(
      { error: "That email is already registered. Try signing in instead." },
      { status: 409 },
    );
  }

  if (ip) {
    const accounts = rateLimit(`signup:created:${ip}`, ACCOUNTS_PER_IP, WINDOW_MS);
    if (!accounts.ok) {
      return NextResponse.json(
        { error: "Too many accounts from this connection. Please try later." },
        { status: 429, headers: { "Retry-After": String(accounts.retryAfter) } },
      );
    }
  }

  const passwordHash = await hashPassword(password);
  let user;
  try {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
        countryId,
        // Recorded at the moment of acceptance, so "which version did
        // they agree to" is answerable from the timestamp alone.
        termsAcceptedAt: new Date(),
      },
      select: { id: true },
    });
  } catch {
    return NextResponse.json(
      { error: "Couldn't create your account. Please try again." },
      { status: 500 },
    );
  }

  // Only now. Verifying does not spend the challenge, so a taken email
  // or a database hiccup doesn't also cost the person the sum they
  // just did — but one solved sum can never make two accounts.
  spend(captcha.nonce);

  await logUserActivity({
    userId: user.id,
    type: "SIGNED_UP",
    message: "Account created.",
  });

  // Notify every admin — this is the first user-management event
  // the bell surfaces. Fire-and-forget so a notif failure doesn't
  // block the signup response.
  createForAllAdmins({
    type: "USER_SIGNED_UP",
    title: `${displayName} joined`,
    message: email,
    actionUrl: `/admin/users/${user.id}`,
  });

  // Sign the user in immediately — waiting for verification would
  // create a dead-end on the signup page. They can browse; the
  // banner reminds them to verify.
  await setUserCookie(user.id);

  // Fire the confirmation email. Best-effort — failures land in
  // the email log but we don't block signup on them (the user can
  // re-request from the banner).
  const appUrl = appBaseUrl(request);
  const confirmResult = await sendConfirmationEmail(
    { id: user.id, email, displayName },
    appUrl,
  );

  return NextResponse.json({
    ok: true,
    emailSent: confirmResult.ok,
    emailError: confirmResult.ok ? undefined : confirmResult.error,
  });
}
