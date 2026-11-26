/**
 * A country's name, in the reader's language, for nothing.
 *
 * ── WHY THIS IS NOT A TRANSLATION ──
 *
 * Every country already has a name in every language, and every
 * browser and every Node build ships the whole table: `Intl` exists
 * precisely so that nobody has to send "United States" to a machine
 * translator and store the answer. Country names were the last thing
 * on this site still reading English on a Russian page, and they were
 * the one thing that never needed Google at all — the ISO code was
 * sitting in the `countries` table the whole time.
 *
 * So: no cache row, no API call, no admin step, nothing to fill in
 * when a language is switched on, and no month where a name is right
 * on one page and stale on another. It is the same argument as the
 * month names in `month-year.ts`, and it arrives at the same answer.
 *
 * ── WHAT IT REFUSES TO DO ──
 *
 * `Intl.DisplayNames` throws on a malformed locale and, asked for a
 * region that is not one, either throws or hands back the input. A
 * country name is a small piece of furniture on a page; none of those
 * outcomes may take the page down or, worse, print "XK" where a
 * country should be. Every path that cannot produce a real name falls
 * back to the English name already stored on the row, which is what
 * the site showed before this function existed.
 *
 * NO IMPORTS, on purpose: the feed renders country names in a client
 * component and the same names appear in server-rendered pages. Both
 * sides call this, so it must be safe on both — the same rule as
 * `i18n-core.ts` and `delete-confirm.ts`.
 */

/** ISO 3166-1: two letters, or three digits. Anything else is not one. */
const REGION = /^([A-Za-z]{2}|[0-9]{3})$/;

/**
 * Cheap, because a feed of twenty posts asks twenty times and a
 * country picker asks two hundred. Building a `DisplayNames` is the
 * expensive part; looking one up in it is not.
 */
const formatters = new Map<string, Intl.DisplayNames | null>();

function formatterFor(locale: string): Intl.DisplayNames | null {
  if (formatters.has(locale)) return formatters.get(locale) ?? null;
  let made: Intl.DisplayNames | null = null;
  try {
    // `fallback: "none"` so an unknown region comes back undefined
    // rather than as the raw code — "XK" is not a country name, and
    // printing it would be worse than printing the English.
    made = new Intl.DisplayNames([locale], { type: "region", fallback: "none" });
  } catch {
    made = null;
  }
  formatters.set(locale, made);
  return made;
}

/**
 * @param locale  the reader's language, e.g. "ru"
 * @param code    ISO 3166-1 alpha-2 from the `countries` table
 * @param fallback the English name stored beside it
 */
export function countryLabel(
  locale: string | null | undefined,
  code: string | null | undefined,
  fallback: string | null | undefined,
): string {
  const english = (fallback ?? "").trim();
  if (!locale || !code || !REGION.test(code)) return english;
  const f = formatterFor(locale);
  if (!f) return english;
  try {
    return f.of(code.toUpperCase()) || english;
  } catch {
    return english;
  }
}
