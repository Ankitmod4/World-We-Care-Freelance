/**
 * GET /api/user/auth/captcha — hand out one arithmetic challenge.
 *
 * Public and unauthenticated, because it is needed before an account
 * exists. The only thing worth protecting here is the effort of
 * issuing one, which is a hash and nine random bytes — so the limit is
 * generous, and exists to stop a loop rather than a person who keeps
 * pressing refresh because they misread a 6 as an 8.
 */

import { NextRequest, NextResponse } from "next/server";
import { issueChallenge } from "@/lib/captcha";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const PER_IP = 40;
const WINDOW_MS = 10 * 60_000;

export async function GET(request: NextRequest) {
  const ip = clientIp(request);
  if (ip) {
    const limit = rateLimit(`captcha:${ip}`, PER_IP, WINDOW_MS);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a few minutes." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }
  }

  const challenge = issueChallenge();

  return NextResponse.json(challenge, {
    // Never cached: a shared challenge is no challenge, and a CDN
    // holding one would hand the same sum to everybody.
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
