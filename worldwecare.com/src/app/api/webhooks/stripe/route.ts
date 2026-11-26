/**
 * Stripe webhook.
 *
 * The signature check is the entire security model here: this endpoint
 * is unauthenticated by necessity, and without verification anyone who
 * knows the URL could POST a "payment succeeded" and credit themselves.
 * The raw body text is required — parsing and re-serialising the JSON
 * changes the bytes and the signature stops matching.
 */
import { NextRequest, NextResponse } from "next/server";
import { applyStripeEvent } from "@/lib/donations";
import { getPaymentSettings } from "@/lib/payments";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
// Node runtime: signature verification needs node:crypto.
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const settings = await getPaymentSettings();
  if (!settings.webhookSecret) {
    // 500, not 400: this is our misconfiguration, and a 5xx makes
    // Stripe retry once it's fixed instead of discarding the event.
    console.error("[stripe] webhook received but no signing secret is configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const raw = await request.text();

  let event;
  try {
    const stripe = await getStripe();
    event = stripe.webhooks.constructEvent(raw, signature, settings.webhookSecret);
  } catch (err) {
    console.warn("[stripe] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const result = await applyStripeEvent(event);
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    // A 500 here is deliberate — Stripe retries, and a transient DB
    // error must not silently lose a payment that really happened.
    console.error("[stripe] handler failed", event.type, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
