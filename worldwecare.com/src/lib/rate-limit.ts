/**
 * A small in-process rate limiter.
 *
 * FIXED WINDOWS, IN MEMORY. That means two things worth knowing before
 * you rely on it:
 *
 *  • It is per Node process. Under `pm2 start -i max` each worker keeps
 *    its own counters, so the effective limit is roughly the configured
 *    one times the worker count. For "stop a script creating 2,800
 *    accounts" that is still the difference between thousands and a
 *    handful; for anything where the exact number matters, this needs
 *    to move into the database or Redis.
 *  • Counters reset when the process restarts. A deploy forgives
 *    everyone. That is fine here and would not be fine for, say,
 *    lockout after failed logins.
 *
 * It is deliberately not a dependency. The alternative was a package
 * that wants Redis to do what a Map does at this size.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

/** Drop expired buckets so a long-lived process doesn't grow forever. */
function sweep(now: number): void {
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
  lastSweep = now;
}

export interface RateResult {
  ok: boolean;
  /** Seconds until the window resets. Only meaningful when !ok. */
  retryAfter: number;
}

/**
 * Count one hit against `key`. Returns `ok: false` once `limit` hits
 * have happened inside `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  if (now - lastSweep > 60_000) sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { ok: true, retryAfter: 0 };
}

/**
 * The caller's IP, as far as we can tell.
 *
 * Returns null when there is nothing trustworthy to key on, and every
 * caller MUST treat null as "don't rate limit" rather than bucketing
 * under a shared "unknown".
 *
 * The reason is the failure mode. If nginx is not sending
 * X-Forwarded-For, every request in the world looks identical — and a
 * limiter that lumps them together does not fail open with a bit more
 * spam, it fails closed and locks out the entire internet after five
 * signups. Losing the limit is recoverable by fixing one nginx line;
 * a site nobody can join is an outage.
 *
 * Requires this in the server block, which is also what makes the
 * access log useful:
 *
 *   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
 *   proxy_set_header X-Real-IP       $remote_addr;
 */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Left-most entry is the original client; the rest are proxies.
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip")?.trim();
  return real || null;
}
