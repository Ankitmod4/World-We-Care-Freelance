/**
 * POST /api/mediamtx/auth — the door to every private session.
 *
 * MediaMTX calls this once before each publish and each read. Whatever
 * it answers is the whole of the access control on a one-to-one
 * therapy session, so the rules here are strict on purpose:
 *
 *  · DENY IS THE DEFAULT. Every path out of this handler that is not
 *    an explicit allow returns 401. There is no branch that falls
 *    through to success.
 *
 *  · THE ANSWER CARRIES NO INFORMATION. Allowed is 200 with an empty
 *    body; denied is 401 with an empty body, whatever the reason.
 *    The reason is written to our log and never to the wire — an
 *    error that distinguished "no such session" from "wrong token"
 *    would let someone map the sessions that exist.
 *
 *  · ONLY MEDIAMTX MAY ASK. The media server has a fixed address, so
 *    the source IP is checked against an allowlist. This is a second
 *    lock, not the only one: even an attacker who reached this
 *    endpoint would still need a live grant token, which they could
 *    have used directly.
 *
 *  · IT ANSWERS FAST. MediaMTX holds the client's connection while it
 *    waits. The bookkeeping write happens after the response is
 *    decided, not before it.
 *
 * Deliberately NOT protected by a shared secret in the URL: MediaMTX
 * can't add a header to this request, so a secret would have to live
 * in the path, which would put it in both servers' access logs.
 *
 * ── PUBLISHING AND READING ARE NOT SYMMETRIC ──
 *
 * A broadcast is one publisher and a crowd. Publishing needs the
 * owner's grant. READING NEEDS NOTHING, because there is no way to
 * issue a token to an anonymous viewer — so that branch is guarded by
 * the stream being live and not ended, rather than by anything the
 * caller presents. It is the only path through this file that allows
 * a request with no credential.
 */

import { NextRequest, NextResponse } from "next/server";
import { getMediamtxConfig } from "@/lib/mediamtx";
import {
  authoriseStream,
  noteStreamGrantUse,
  parseStreamPath,
} from "@/lib/live-streams";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** No body either way — see the header. */
const ALLOW = () => new NextResponse(null, { status: 200 });
const DENY = () => new NextResponse(null, { status: 401 });

interface AuthBody {
  user?: unknown;
  password?: unknown;
  token?: unknown;
  ip?: unknown;
  action?: unknown;
  path?: unknown;
  protocol?: unknown;
  id?: unknown;
  query?: unknown;
}

function callerIp(request: NextRequest): string | null {
  // Behind a proxy the left-most XFF entry is the real client, which
  // here is MediaMTX itself.
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

/**
 * The bearer token, from wherever MediaMTX put it.
 *
 * `token` is where a Bearer header lands. `password` is where the
 * second half of Basic auth lands, which is what some WHIP clients
 * send. Accept both so a client that can only do one still works.
 */
function bearerFrom(body: AuthBody): string {
  const t = typeof body.token === "string" ? body.token.trim() : "";
  if (t) return t;
  const p = typeof body.password === "string" ? body.password.trim() : "";
  return p;
}

export async function POST(request: NextRequest) {
  const config = await getMediamtxConfig();
  if (!config.enabled) {
    console.warn("[mediamtx-auth] deny: streaming disabled");
    return DENY();
  }

  const from = callerIp(request);
  if (config.allowedIps.length > 0 && (!from || !config.allowedIps.includes(from))) {
    console.warn(`[mediamtx-auth] deny: source ${from ?? "unknown"} not allowed`);
    return DENY();
  }

  const body = (await request.json().catch(() => null)) as AuthBody | null;
  if (!body) {
    console.warn("[mediamtx-auth] deny: unparseable body");
    return DENY();
  }

  const action = typeof body.action === "string" ? body.action : "";
  const path = typeof body.path === "string" ? body.path : "";

  // MediaMTX asks about its own API, metrics and pprof too unless
  // they're excluded in its config. We never authorise those from
  // here — they are configured with an internal user instead.
  if (action === "api" || action === "metrics" || action === "pprof") {
    console.warn(`[mediamtx-auth] deny: control action "${action}" asked over the hook`);
    return DENY();
  }

  const token = bearerFrom(body);
  const clientIp = typeof body.ip === "string" ? body.ip : null;

  // Shape first, before any query: a path that isn't one of ours
  // never reaches the database.
  const slug = parseStreamPath(config, path);
  if (!slug) {
    console.warn(`[mediamtx-auth] deny: "${path}" is not a stream path`);
    return DENY();
  }

  let verdict: { allow: boolean; reason: string };
  try {
    verdict = await authoriseStream({ slug, action, token });
  } catch (err) {
    // A database blip must not become an open door.
    console.error("[mediamtx-auth] deny: authorise threw", err);
    return DENY();
  }

  if (!verdict.allow) {
    console.warn(
      `[mediamtx-auth] deny ${action} ${path || "-"} from ${clientIp ?? "?"} — ${verdict.reason}`,
    );
    return DENY();
  }

  // Answer first. The counter is diagnostics; MediaMTX is holding a
  // person's connection open while it waits for this. Anonymous
  // viewers have no grant to count against.
  if (token) void noteStreamGrantUse(token, clientIp);

  return ALLOW();
}

/**
 * MediaMTX only ever POSTs here. Anything else gets the same 401 as a
 * failed auth rather than a 405, so probing tells nobody that this
 * endpoint is real.
 */
export async function GET() {
  return DENY();
}
