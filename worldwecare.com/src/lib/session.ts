/**
 * Signed opaque session cookies.
 *
 * Token shape: `<base64url(payload)>.<base64url(sig)>`
 *   payload = `${subjectId}:${issuedAtMs}`
 *   sig     = HMAC-SHA256(payload, secret)
 *
 * Uses the Web Crypto API (SubtleCrypto) so this file runs in both
 * the Node runtime (route handlers, server components) AND the Edge
 * runtime (middleware). node:crypto would fail to bundle for edge —
 * we deliberately avoid it here.
 *
 * The cookie holds nothing sensitive on its own — the payload is an
 * id plus a timestamp — and rotating the secret invalidates every
 * session at once. Admin and user cookies use different secrets so
 * leaking one can't be replayed against the other.
 *
 * THE ISSUED-AT TIMESTAMP IS NOT DECORATION. It is what makes
 * revocation possible without a session table: `getCurrentUser`
 * compares it against the account's `sessionsValidFrom` and rejects
 * anything minted before it. That is how a password change signs out
 * every other device. `verifyTokenDetailed` is the accessor for it —
 * `verifyToken` remains the answer to the only question middleware
 * can ask at the edge, where there is no database to compare against.
 *
 * Constant-time comparison is implemented in userland — Web Crypto
 * has no timingSafeEqual — with the standard "OR every diff into an
 * accumulator" pattern.
 */

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const HMAC_ALGO = { name: "HMAC", hash: "SHA-256" as const };

export interface SessionCookie {
  /** Cookie name — MUST be distinct per session kind. */
  name: string;
  /** Signing secret — MUST be distinct per session kind. Falls back
   *  to a hard-coded dev string when the env var isn't set so the
   *  server boots in a fresh clone; real deployments set both env
   *  vars explicitly. */
  secret: string;
}

export const ADMIN_COOKIE: SessionCookie = {
  name: "wwc-admin-session",
  secret:
    process.env.ADMIN_SESSION_SECRET ??
    "dev-admin-fallback-do-not-use-in-production",
};

export const USER_COOKIE: SessionCookie = {
  name: "wwc-user-session",
  secret:
    process.env.USER_SESSION_SECRET ??
    "dev-user-fallback-do-not-use-in-production",
};

/**
 * "This account's email is confirmed" — a claim the edge middleware
 * can check without a database, which it has no way to reach.
 *
 * Holds the same subject id as the session cookie, and the middleware
 * only accepts it when the two ids match. That is what makes it safe
 * to trust: forging one needs the signing key, and DELETING one leaves
 * the holder looking unverified, which is the safe direction to fail.
 *
 * THE SECRET IS DELIBERATELY NOT `USER_SESSION_SECRET` ITSELF. Both
 * cookies use the same format, so with a shared key the session cookie
 * would verify as a valid verified-claim — and anyone can read their
 * own cookies out of dev tools and post them back under another name.
 * httpOnly stops scripts, not the person holding the browser.
 */
export const USER_VERIFIED_COOKIE: SessionCookie = {
  name: "wwc-user-verified",
  secret: `${
    process.env.USER_SESSION_SECRET ?? "dev-user-fallback-do-not-use-in-production"
  }:email-verified-v1`,
};

// ── base64url (no padding) — pure Web APIs so it works in edge ──

function b64urlEncode(bytes: Uint8Array): string {
  // Chunk the fromCharCode call so very large inputs don't blow the
  // argument list. Session payloads are tiny (< 100 bytes) so this
  // never actually triggers, but keeping it correct is cheap.
  let str = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    str += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(input: string): Uint8Array {
  const padNeeded = (4 - (input.length % 4)) % 4;
  const b64 =
    input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padNeeded);
  const str = atob(b64);
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i);
  return out;
}

// ── HMAC via SubtleCrypto ──────────────────────────────────────────

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    HMAC_ALGO,
    false,
    ["sign", "verify"],
  );
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign(
    HMAC_ALGO,
    key,
    new TextEncoder().encode(payload),
  );
  return b64urlEncode(new Uint8Array(sig));
}

/** Constant-time byte compare. JIT can theoretically undermine this
 *  but the alternative — early-out equality — is provably worse. */
function ctEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ── Public API ─────────────────────────────────────────────────────

/** Build a signed token for the given subject id. */
export async function issueToken(
  cookie: SessionCookie,
  subjectId: string,
): Promise<string> {
  const payload = `${subjectId}:${Date.now()}`;
  const encoded = b64urlEncode(new TextEncoder().encode(payload));
  const sig = await sign(encoded, cookie.secret);
  return `${encoded}.${sig}`;
}

export interface VerifiedToken {
  subjectId: string;
  /** When this cookie was minted. Compare against a revocation
   *  cut-off to decide whether it still counts. */
  issuedAt: number;
}

/** Verify a token and return the subject id on success. Returns null
 *  for anything malformed, tampered, or expired. */
export async function verifyToken(
  cookie: SessionCookie,
  token: string | null | undefined,
): Promise<string | null> {
  return (await verifyTokenDetailed(cookie, token))?.subjectId ?? null;
}

/** As `verifyToken`, but also hands back when the cookie was issued —
 *  needed by anything that can check a revocation cut-off. */
export async function verifyTokenDetailed(
  cookie: SessionCookie,
  token: string | null | undefined,
): Promise<VerifiedToken | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;

  const expectedSig = await sign(encoded, cookie.secret);
  const a = b64urlDecode(providedSig);
  const b = b64urlDecode(expectedSig);
  if (!ctEqual(a, b)) return null;

  let payload: string;
  try {
    payload = new TextDecoder().decode(b64urlDecode(encoded));
  } catch {
    return null;
  }
  const [subjectId, issuedAtRaw] = payload.split(":");
  if (!subjectId || !issuedAtRaw) return null;
  const issuedAt = Number.parseInt(issuedAtRaw, 10);
  if (!Number.isFinite(issuedAt)) return null;
  const ageSeconds = (Date.now() - issuedAt) / 1000;
  if (ageSeconds < 0 || ageSeconds > MAX_AGE_SECONDS) return null;
  return { subjectId, issuedAt };
}

/** Standard Set-Cookie options for a session cookie. Applied to
 *  both admin + user cookies. HttpOnly so JS can never touch it,
 *  SameSite=Lax so a legit link from another site still authenticates,
 *  Secure when we're in production. */
export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}
