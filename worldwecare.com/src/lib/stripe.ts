/**
 * Stripe client, built from the keys an admin saved rather than from
 * the environment.
 *
 * Deliberately not a module-level singleton: the key can change from
 * the settings page, and a cached client would keep talking to the old
 * account until the process restarted. The instance is cached against
 * the key itself, so it's rebuilt exactly when it needs to be.
 */

import Stripe from "stripe";
import { getPaymentSettings } from "./payments";

let cached: { key: string; client: Stripe } | null = null;

function clientFor(secretKey: string): Stripe {
  if (cached && cached.key === secretKey) return cached.client;
  const client = new Stripe(secretKey, {
    // The SDK only accepts the version it was generated against, so
    // this moves when the `stripe` package is upgraded — deliberately,
    // since a mismatch is a compile error rather than a runtime
    // surprise in a webhook.
    apiVersion: "2026-08-26.dahlia",
    typescript: true,
    maxNetworkRetries: 2,
    timeout: 20_000,
    appInfo: { name: "WorldWeCare", version: "1.0.0" },
  });
  cached = { key: secretKey, client };
  return client;
}

/** Throws with a message worth showing if Stripe isn't set up yet. */
export async function getStripe(): Promise<Stripe> {
  const s = await getPaymentSettings();
  if (!s.secretKey) {
    throw new Error("Stripe isn't connected yet — add the secret key in admin settings.");
  }
  return clientFor(s.secretKey);
}

/** True when there is enough configuration to take a payment. */
export async function stripeReady(): Promise<boolean> {
  const s = await getPaymentSettings();
  return !!(s.enabled && s.secretKey && s.publishableKey);
}

export interface ConnectionResult {
  ok: boolean;
  /** Safe to show. Never contains the key. */
  message: string;
  accountName?: string;
  accountId?: string;
  country?: string;
  defaultCurrency?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  /** What the KEY is, regardless of what the mode dropdown says. */
  livemode?: boolean;
  /** Set when the key's mode and the configured mode disagree. */
  modeMismatch?: boolean;
}

/**
 * What the "Test connection" button calls.
 *
 * Uses the key passed in when there is one, so an admin can check a key
 * BEFORE saving it — checking only what's already stored makes the
 * button useless for the case it exists for.
 *
 * Every failure returns ok:false with a readable message rather than
 * throwing. Stripe's own error text is passed through because it is
 * genuinely the most useful thing available ("Invalid API Key
 * provided: sk_test_***"), and it never contains the full key.
 */
export async function testConnection(candidateKey?: string): Promise<ConnectionResult> {
  const settings = await getPaymentSettings();
  const key = (candidateKey || settings.secretKey || "").trim();

  if (!key) {
    return { ok: false, message: "No secret key to test — paste one in first." };
  }
  if (!key.startsWith("sk_") && !key.startsWith("rk_")) {
    return {
      ok: false,
      message:
        "That doesn't look like a Stripe secret key. It should start with sk_test_ or sk_live_ — the pk_ one is the publishable key and belongs in the field above.",
    };
  }

  try {
    const stripe = clientFor(key);
    // A null id means "the account this key belongs to" — a cheap read
    // that still proves the key is valid and permitted.
    const account = await stripe.accounts.retrieve(null);
    const livemode = key.startsWith("sk_live_") || key.startsWith("rk_live_");
    const modeMismatch = livemode !== (settings.mode === "live");

    const name =
      account.business_profile?.name ||
      account.settings?.dashboard?.display_name ||
      account.email ||
      account.id;

    return {
      ok: true,
      message: modeMismatch
        ? `Connected to ${name}, but this is a ${livemode ? "LIVE" : "TEST"} key while the mode above is set to ${settings.mode.toUpperCase()}. Fix one of them before going live.`
        : `Connected to ${name}.`,
      accountName: name,
      accountId: account.id,
      country: account.country ?? undefined,
      defaultCurrency: account.default_currency ?? undefined,
      chargesEnabled: account.charges_enabled ?? undefined,
      payoutsEnabled: account.payouts_enabled ?? undefined,
      livemode,
      modeMismatch,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Couldn't reach Stripe with that key.";
    return { ok: false, message };
  }
}
