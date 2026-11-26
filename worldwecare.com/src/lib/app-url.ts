/**
 * Where this site actually lives, as far as an outgoing link is
 * concerned.
 *
 * THE BUG THIS EXISTS TO KILL. Behind nginx, `proxy_pass
 * http://localhost:3000` sends `Host: localhost:3000` unless the
 * config says otherwise — so Next's own `request.nextUrl.origin` is
 * "http://localhost:3000", and anything built from it (a redirect, a
 * confirmation link in an email) points at a machine the recipient
 * does not have.
 *
 * ORDER OF PREFERENCE, and the reasoning is mostly about trust:
 *
 *   1. `APP_URL`. Configuration, not a header, so nothing a client
 *      sends can move it. This is the one to set in production.
 *   2. `X-Forwarded-Host` / `X-Forwarded-Proto`, then `Host`.
 *      Convenient, and WRONG TO TRUST BLINDLY: if the proxy passes
 *      through whatever the client sent, an attacker can put their own
 *      domain in a password-reset link that we then email to the
 *      victim. That is why these come second, and why `APP_URL` is
 *      worth the thirty seconds it takes to set.
 *   3. `Origin`, which browsers attach to fetch and form posts but not
 *      to a plain link click — which is exactly the case that broke.
 *   4. localhost, for `next dev`.
 */

function clean(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  // "a.example, b.example" — a forwarded header can carry a list.
  const first = v.split(",")[0]?.trim();
  return first || null;
}

/** Anything with a `.get(name)` — `Request.headers`, or the read-only
 *  bag `headers()` hands a server component. */
interface HeaderBag {
  get(name: string): string | null;
}

/**
 * The origin when there is no request to read — a cron job, a script.
 *
 * `APP_URL` or nothing. The header fallbacks in `appOriginFrom` exist
 * because a browser request carries hints worth using; a background job
 * carries none, so guessing here would only produce links to
 * localhost in somebody's inbox.
 */
export function appUrlFromEnv(): string {
  return (process.env.APP_URL ?? "").replace(/\/+$/, "");
}

export function appOriginFrom(h: HeaderBag): string {
  const configured = clean(process.env.APP_URL);
  if (configured) return configured.replace(/\/+$/, "");

  const forwardedHost = clean(h.get("x-forwarded-host"));
  if (forwardedHost) {
    const proto = clean(h.get("x-forwarded-proto")) ?? "https";
    return `${proto}://${forwardedHost}`;
  }

  const host = clean(h.get("host"));
  // A Host of localhost behind a proxy is the misconfiguration above,
  // not a real answer — skip it and try the Origin header instead.
  if (host && !/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host)) {
    const proto = clean(h.get("x-forwarded-proto")) ?? "https";
    return `${proto}://${host}`;
  }

  const origin = clean(h.get("origin"));
  if (origin) return origin.replace(/\/+$/, "");

  return "http://localhost:3000";
}

export function appOrigin(request: Request): string {
  return appOriginFrom(request.headers);
}

/** The origin with a trailing slash — what the email templates want. */
export function appBaseUrl(request: Request): string {
  return `${appOriginFrom(request.headers)}/`;
}
