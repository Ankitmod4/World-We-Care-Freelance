/**
 * Authenticated encryption for secrets kept in the database.
 *
 * Two things go through here, and both would be serious to leak:
 *   • the Stripe secret key, stored in platform_settings
 *   • members' payout details — PayPal addresses, bank numbers
 *
 * AES-256-GCM, random 96-bit nonce per message, auth tag appended. The
 * output is "v1.<nonce>.<ciphertext+tag>" in base64url so the version
 * is visible and a future scheme can be added without guessing.
 *
 * The key comes from PAYMENTS_SECRET when set. Otherwise it is derived
 * from USER_SESSION_SECRET with a domain string, the same fallback
 * captcha.ts uses — one fewer environment variable to forget on
 * deploy, and the domain separation means a leaked session token can't
 * be replayed against this and vice versa.
 *
 * Rotating PAYMENTS_SECRET makes existing ciphertexts unreadable. That
 * is the correct behaviour (they are secrets, not cache) but it means
 * the admin has to re-enter the Stripe key and members re-enter payout
 * details, so `canDecrypt` exists to detect it and say so rather than
 * throwing somewhere confusing.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const DOMAIN = "wwc-payments-v1";
const VERSION = "v1";

function key(): Buffer {
  const raw = process.env.PAYMENTS_SECRET || process.env.USER_SESSION_SECRET || "";
  if (!raw) {
    throw new Error(
      "Set PAYMENTS_SECRET (or USER_SESSION_SECRET) before storing payment secrets.",
    );
  }
  // SHA-256 to a fixed 32 bytes regardless of how long the env value is.
  return createHash("sha256").update(`${DOMAIN}:${raw}`).digest();
}

/** True when a key is configured at all — checked before the settings page offers to save. */
export function secretsConfigured(): boolean {
  return !!(process.env.PAYMENTS_SECRET || process.env.USER_SESSION_SECRET);
}

export function seal(plaintext: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), nonce);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    nonce.toString("base64url"),
    Buffer.concat([body, tag]).toString("base64url"),
  ].join(".");
}

/**
 * Returns null rather than throwing on anything malformed, tampered
 * with, or encrypted under a previous key. Callers treat null as "not
 * set" — a payout method that can't be decrypted must not crash the
 * admin queue, it must show as needing re-entry.
 */
export function open(sealed: string | null | undefined): string | null {
  if (!sealed || typeof sealed !== "string") return null;
  const parts = sealed.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) return null;
  try {
    const nonce = Buffer.from(parts[1], "base64url");
    const blob = Buffer.from(parts[2], "base64url");
    if (nonce.length !== 12 || blob.length < 17) return null;
    const tag = blob.subarray(blob.length - 16);
    const body = blob.subarray(0, blob.length - 16);
    const decipher = createDecipheriv("aes-256-gcm", key(), nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Whether a stored value is readable under the current key. */
export function canDecrypt(sealed: string | null | undefined): boolean {
  return open(sealed) !== null;
}

/**
 * "sk_live_51H…9xQm" → "sk_live_…9xQm".
 *
 * What the settings page renders once a key is saved. Never send the
 * whole thing back to a browser: an admin session that leaks shouldn't
 * hand over the Stripe account with it.
 */
export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v.length <= 12) return "…";
  const head = v.slice(0, v.startsWith("sk_") || v.startsWith("whsec_") ? 11 : 4);
  return `${head}…${v.slice(-4)}`;
}
