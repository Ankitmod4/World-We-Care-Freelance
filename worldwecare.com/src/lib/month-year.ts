/**
 * "March 2024", in the reader's language.
 *
 * ── WHY THIS IS ITS OWN FILE ──
 *
 * There were two copies of this, one in each profile component, and
 * both passed the literal `"en-US"`. So a member reading in Russian
 * got a Russian page with "Member since March 2024" sitting in the
 * middle of it. Two copies of the same mistake is the same story as
 * the reaction labels that drifted apart: the second copy is written
 * by someone who did not know the first existed, and neither gets
 * fixed when one does.
 *
 * `Intl` already knows every month name in every language, so nothing
 * here needs translating, storing, or paying Google for — the locale
 * just has to be passed in rather than hard-coded.
 *
 * An unparseable date returns "" rather than "Invalid Date", because
 * a profile with a missing timestamp should show one thing less, not
 * a browser error rendered as a sentence.
 */
export function monthYear(iso: string, locale = "en"): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  try {
    return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
  } catch {
    // An unknown or malformed locale tag throws RangeError. English is
    // a better answer than a blank profile.
    return d.toLocaleDateString("en", { month: "long", year: "numeric" });
  }
}
