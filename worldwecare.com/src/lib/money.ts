/**
 * Money arithmetic and parsing. NO imports — that is the point.
 *
 * These used to live in `payments.ts`, which imports Prisma. A client
 * component therefore could not use them without pulling the database
 * client into the browser bundle, so every form in the app open-coded
 * its own `Number(x.replace(/[^0-9.]/g, ""))` instead — including the
 * donation amount field, where it charged a donor typing "10,50"
 * one thousand and fifty dollars. The guarded parser existed and was
 * tested the whole time; nothing could reach it.
 *
 * Anything here must stay free of imports so that it can.
 */

/**
 * A fee over 100% would mean a member owes money to withdraw their own
 * money, which is never intended and is almost certainly a typo — an
 * admin meaning 1 and typing 10000.
 */
export function clampBp(bp: number): number {
  return Math.min(10_000, Math.max(0, Math.round(bp)));
}

/**
 * Split an amount into fee and net.
 *
 * Rounds the fee to the nearest cent and derives net by subtraction,
 * so fee + net === amount exactly, for every amount, with no drift to
 * reconcile later.
 */
export function splitFee(
  amountCents: number,
  basisPoints: number,
): { feeCents: number; netCents: number } {
  const amount = Math.max(0, Math.trunc(amountCents));
  const bp = clampBp(basisPoints);
  const feeCents = Math.round((amount * bp) / 10_000);
  return { feeCents, netCents: amount - feeCents };
}

/** 12345 → "$123.45". Display only; never feed this back into maths. */
export function formatCents(cents: number, currency = "usd"): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  // Grouped, because this renders admin totals as well as $5 buttons,
  // and "$486000.00" is a number nobody can read at a glance. The
  // separator is the same one `parseAmountToCents` accepts, so a
  // formatted value can be pasted straight back into a form.
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = `${whole}.${String(abs % 100).padStart(2, "0")}`;
  const symbol = currency.toLowerCase() === "usd" ? "$" : "";
  return symbol
    ? `${sign}${symbol}${body}`
    : `${sign}${body} ${currency.toUpperCase()}`;
}

/**
 * "12.34" / "12" / "$1,234.56" / 12.34 → cents. Null if unparseable.
 *
 * A comma is only accepted as a THOUSANDS separator, in full groups of
 * three. It is deliberately NOT treated as a decimal point: "10,5"
 * means 10.50 to most of Europe and 105 to a naive strip-and-parse,
 * and silently choosing the second charges someone ten times over.
 * Ambiguous input is refused so the form can ask again.
 */
export function parseAmountToCents(raw: unknown): number | null {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    return Math.round(raw * 100);
  }
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim().replace(/[$\s]/g, "");
  if (!trimmed) return null;

  if (trimmed.includes(",")) {
    // Only "1,234" / "1,234,567.89" shapes survive.
    if (!/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(trimmed)) return null;
  }

  const clean = trimmed.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}
