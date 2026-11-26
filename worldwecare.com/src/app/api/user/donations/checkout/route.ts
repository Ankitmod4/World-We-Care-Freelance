/** POST — start a Stripe Checkout session for a donation. */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";
import { createCheckout, DonationRefused } from "@/lib/donations";
import { appBaseUrl } from "@/lib/app-url";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Anonymous donations are allowed, so this endpoint is reachable with
// no session — and every call inserts a row and makes an outbound
// Stripe request. Unthrottled, a loop here exhausts the Stripe API
// rate limit (100/s live, 25/s test), at which point REAL donors start
// getting errors from this same endpoint, and it grows the donations
// table without bound.
//
// Generous by design: a donor correcting a card or changing their mind
// legitimately starts checkout several times.
const STARTS_PER_IP = 12;
const WINDOW_MS = 10 * 60_000;

export async function POST(request: NextRequest) {
  // Signed out is allowed — a donor doesn't need an account. They just
  // won't get a history page, because there's nothing to attach it to.
  const viewer = await getCurrentUser();

  const ip = clientIp(request);
  // null means we cannot tell callers apart; see clientIp — bucketing
  // them together would lock out everyone rather than nobody.
  if (ip) {
    const gate = rateLimit(`donate:start:${ip}`, STARTS_PER_IP, WINDOW_MS);
    if (!gate.ok) {
      return NextResponse.json(
        { error: "That's a lot of donation attempts. Give it a few minutes." },
        { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
      );
    }
  }

  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const base = appBaseUrl(request);

  try {
    const result = await createCheckout({
      // Cents from the client, re-checked against the configured
      // minimum and maximum inside createCheckout.
      amountCents: Number(b.amountCents),
      recipientUserId: typeof b.recipientUserId === "string" ? b.recipientUserId : null,
      campaignId: typeof b.campaignId === "string" ? b.campaignId : null,
      eventId: typeof b.eventId === "string" ? b.eventId : null,
      liveStreamId: typeof b.liveStreamId === "string" ? b.liveStreamId : null,
      donorUserId: viewer?.id ?? null,
      donorEmail:
        viewer?.email ?? (typeof b.donorEmail === "string" ? b.donorEmail : null),
      message: typeof b.message === "string" ? b.message : null,
      isAnonymous: b.isAnonymous === true,
      successUrl: `${base}/donate/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/donate/cancelled`,
    });
    return NextResponse.json({ ok: true, url: result.url });
  } catch (err) {
    // `createCheckout` throws two different kinds of thing, and they
    // must not be reported the same way.
    //
    // Its own validation messages are written FOR the donor ("The
    // smallest donation is $1.00") and are safe and useful. Anything
    // else — a Stripe SDK error, a Prisma error — is internal, and
    // reflecting it told an anonymous caller whether the platform was
    // configured, which mode it was in, and the prefix of a live key.
    //
    // The status matters too: a Stripe outage is not the donor getting
    // something wrong, and a 400 tells the UI to blame their input.
    if (err instanceof DonationRefused) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[donations] checkout failed", err);
    return NextResponse.json(
      { error: "We couldn't start that donation. Please try again shortly." },
      { status: 502 },
    );
  }
}
