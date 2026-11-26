/**
 * A small arithmetic captcha for the signup form.
 *
 * WHY THIS AND NOT reCAPTCHA. The registrations we are stopping came
 * from a commodity script POSTing straight at /api/user/auth/signup —
 * 2,800 of them. Nothing about that script understands this site. The
 * bar it has to clear now is: fetch a challenge, read a sum written in
 * prose, do the arithmetic, and send the answer back with the token it
 * came with, inside ten minutes and no faster than a human hand. That
 * is a rewrite of their tool for one site, and there is no solver
 * service that sells the answer because nobody else uses this.
 *
 * It will not stop somebody who decides to target this site
 * specifically. It is not meant to. It is meant to make us not worth
 * the afternoon, and it costs a person one sum they can read out loud
 * — which, unlike a distorted-image captcha, a screen reader can too.
 *
 * STATELESS BY DESIGN. The challenge travels as a signed token, so no
 * table, no cleanup job, and nothing to go stale during a deploy. The
 * only server-side memory is the set of nonces already spent, which is
 * in-process and expires on its own (see `spent` below).
 */

import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** How long a challenge stays answerable. Long enough to read the terms. */
const TTL_MS = 10 * 60_000;

/**
 * The floor on how fast a human can plausibly fill this form.
 *
 * Deliberately low. This is here to catch a script that requests and
 * answers in the same tick, not to police fast typists — a password
 * manager filling everything and a quick "7 + 5" is easily four
 * seconds, and being told off for it would be maddening.
 */
const MIN_SOLVE_MS = 2_000;

/* ── the signing key ─────────────────────────────────────────── */

let ephemeral: string | null = null;

/**
 * Prefers its own key, falls back to the user session secret, and in
 * development to a per-process random one.
 *
 * The random fallback is regenerated rather than defaulted to a
 * constant on purpose: a hard-coded development key is exactly the
 * kind of thing that survives into production because nothing ever
 * breaks to announce it. This way the worst case is that challenges
 * issued before a restart stop verifying, which is loud, local, and
 * harmless.
 */
function key(): string {
  const configured = process.env.CAPTCHA_SECRET || process.env.USER_SESSION_SECRET;
  if (configured) return configured;
  ephemeral ??= randomBytes(32).toString("hex");
  return ephemeral;
}

/** Domain separation — this key also signs session cookies. */
const DOMAIN = "wwc-captcha-v1";

function sign(payload: string): string {
  return createHmac("sha256", key()).update(`${DOMAIN}.${payload}`).digest("base64url");
}

function hashAnswer(nonce: string, answer: number): string {
  return createHash("sha256").update(`${DOMAIN}:${key()}:${nonce}:${answer}`).digest("base64url");
}

/* ── spent nonces ────────────────────────────────────────────── */

/**
 * Nonces already used to create an account, so one solved sum cannot
 * be replayed for a second signup.
 *
 * In-process, like the rate limiter, with the same caveat: under pm2
 * cluster mode a nonce spent on one worker is unknown to the others.
 * That is a bounded loss — a token is only good for TTL_MS and only
 * once per worker — and the per-IP signup limit is the backstop.
 */
const spent = new Map<string, number>();
let lastSweep = Date.now();

function sweep(now: number): void {
  for (const [nonce, expiry] of spent) {
    if (expiry <= now) spent.delete(nonce);
  }
  lastSweep = now;
}

/* ── the sum ─────────────────────────────────────────────────── */

/**
 * Operators are the real Unicode minus and multiplication signs, not
 * "-" and "*". A human reads them identically; the throwaway regex a
 * scraper reaches for (/(\d+)\s*[-+*]\s*(\d+)/) does not match them.
 * Cheap, and it costs the person nothing.
 */
type Op = "+" | "−" | "×";

function build(): { question: string; answer: number } {
  const op: Op = (["+", "−", "×"] as const)[randomInt(3)];

  if (op === "+") {
    const a = randomInt(2, 10);
    const b = randomInt(2, 10);
    return { question: `${a} + ${b}`, answer: a + b };
  }
  if (op === "−") {
    // Bigger number first, always. A negative answer is a fine piece
    // of arithmetic and a terrible thing to spring on someone who is
    // halfway through signing up for a mental health forum.
    const a = randomInt(6, 16);
    const b = randomInt(1, a - 1);
    return { question: `${a} − ${b}`, answer: a - b };
  }
  const a = randomInt(2, 7);
  const b = randomInt(2, 7);
  return { question: `${a} × ${b}`, answer: a * b };
}

/* ── issuing ─────────────────────────────────────────────────── */

interface Payload {
  /** Hash of the answer, not the answer. */
  h: string;
  /** Issued at (ms). */
  i: number;
  /** Expires at (ms). */
  e: number;
  /** Single-use id. */
  n: string;
}

export interface Challenge {
  question: string;
  token: string;
}

export function issueChallenge(): Challenge {
  const { question, answer } = build();
  const now = Date.now();
  const nonce = randomBytes(9).toString("base64url");

  const payload: Payload = {
    h: hashAnswer(nonce, answer),
    i: now,
    e: now + TTL_MS,
    n: nonce,
  };

  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { question, token: `${body}.${sign(body)}` };
}

/* ── verifying ───────────────────────────────────────────────── */

export type VerifyResult =
  | { ok: true; nonce: string }
  | { ok: false; error: string; expired?: boolean };

/**
 * Check an answer against its token.
 *
 * Every failure returns the same shape and a message safe to show. The
 * caller decides what to do next; nothing is marked used here, because
 * a token should survive an unrelated failure further down the signup
 * (a taken email should not also cost you the sum you just did).
 * Call `spend()` once the account actually exists.
 */
export function verifyChallenge(token: unknown, answer: unknown): VerifyResult {
  if (typeof token !== "string" || !token.includes(".")) {
    return { ok: false, error: "Answer the sum below.", expired: true };
  }

  const raw = typeof answer === "string" ? answer.trim() : typeof answer === "number" ? String(answer) : "";
  if (!/^-?\d{1,4}$/.test(raw)) {
    return { ok: false, error: "Type the answer as a number." };
  }
  const value = Number(raw);

  const [body, signature] = token.split(".", 2);
  if (!body || !signature) {
    return { ok: false, error: "Answer the sum below.", expired: true };
  }

  // Constant-time, and length-guarded: timingSafeEqual throws rather
  // than returning false when the two buffers differ in length.
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, error: "That check expired. Here's a new one.", expired: true };
  }

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
  } catch {
    return { ok: false, error: "That check expired. Here's a new one.", expired: true };
  }
  if (!payload || typeof payload.h !== "string" || typeof payload.n !== "string") {
    return { ok: false, error: "That check expired. Here's a new one.", expired: true };
  }

  const now = Date.now();
  if (now - lastSweep > 60_000) sweep(now);

  if (typeof payload.e !== "number" || payload.e <= now) {
    return { ok: false, error: "That check expired. Here's a new one.", expired: true };
  }
  if (spent.has(payload.n)) {
    return { ok: false, error: "That check was already used. Here's a new one.", expired: true };
  }
  if (typeof payload.i !== "number" || now - payload.i < MIN_SOLVE_MS) {
    // Not phrased as an accusation: a person who really did fill this
    // in two seconds gets told to try again, not called a robot.
    return { ok: false, error: "That was quick — please try once more." };
  }

  const actual = Buffer.from(hashAnswer(payload.n, value));
  const stored = Buffer.from(payload.h);
  if (actual.length !== stored.length || !timingSafeEqual(actual, stored)) {
    return { ok: false, error: "That's not the right answer. Here's another." , expired: true };
  }

  return { ok: true, nonce: payload.n };
}

/** Burn a nonce so the same solved sum can't create a second account. */
export function spend(nonce: string): void {
  spent.set(nonce, Date.now() + TTL_MS);
}
