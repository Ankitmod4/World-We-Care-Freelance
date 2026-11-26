/**
 * The Stripe events this app needs delivered. NO imports, so both the
 * webhook handler and the admin setup screen can read the same list.
 *
 * This exists because they drifted. The handler covered three events;
 * the setup instructions told the admin to subscribe to those same
 * three; and the two gaps that left — a delayed payment settling, and
 * a chargeback opening — were invisible from either side. Adding a
 * `case` without adding it here now shows up as a missing instruction,
 * and vice versa.
 *
 * `applyStripeEvent` has a test that asserts it handles exactly these.
 */
export const REQUIRED_STRIPE_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded",
  "charge.refund.updated",
  "charge.dispute.created",
  "charge.dispute.closed",
] as const;

export type RequiredStripeEvent = (typeof REQUIRED_STRIPE_EVENTS)[number];
