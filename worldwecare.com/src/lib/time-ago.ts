/**
 * "3h ago".
 *
 * Extracted because three components had grown their own copy, and a
 * fourth was about to. Two of them said "5m ago" and one said "5m";
 * that difference was accidental, so it is now a parameter rather than
 * a fork.
 *
 * SIX MORE COPIES HAD GROWN BACK by the time the site was translated,
 * and every one of them was hard-coded English — which is how a
 * Russian reader ended up with a fully translated page stamped "4w
 * ago". They differed, too: one stopped at weeks, another went on to
 * years. All seven are now this function, and the longest ladder wins
 * because a post really can be a year old.
 *
 * ── IT TAKES `t` RATHER THAN READING IT ──
 *
 * A plain function cannot call a hook, and this one is called from
 * both client components and (through the entry cards) server ones.
 * Passing the translator in is the only shape that works on both
 * sides, and it keeps this module free of any import at all.
 *
 * ── THE DATE AT THE END IS PINNED TO en-GB AND UTC ──
 *
 * The originals fell back to `toLocaleDateString("en-US")` with no
 * timeZone. Rendered on the server and again in the browser, that
 * produces different strings whenever the two disagree about the
 * timezone — which is a hydration mismatch, the same class of bug that
 * broke the campaign page. Pinning both makes the output identical
 * everywhere.
 */

import type { TFunction } from "./i18n-core";

const FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function timeAgo(
  t: TFunction,
  iso: string,
  opts: { suffix?: boolean } = {},
): string {
  const suffix = opts.suffix ?? true;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";

  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));

  /*
   * "{n}m" AND "{n}m ago" ARE SEPARATE STRINGS, not one with a suffix
   * glued on. English can bolt "ago" onto the end of anything;
   * Russian puts "назад" after the unit and inflects the unit to match
   * the number, and plenty of languages wrap the whole phrase. A
   * translator needs the entire sentence to move.
   *
   * EVERY KEY IS WRITTEN OUT. An earlier version built them as
   * `t(\`time.${u}\`, …)`, which typechecks, reads well, and is
   * invisible to `i18n:extract` — so none of these ever reached the
   * catalogue and a fully translated page still said "4w ago". The
   * scanner only sees literals, so literals is what it gets.
   */
  const m = Math.floor(s / 60);
  if (s < 60) {
    return suffix ? t("time.justNow", "just now") : t("time.now", "now");
  }
  if (m < 60) {
    return suffix
      ? t("time.mAgo", "{n}m ago", { n: m })
      : t("time.m", "{n}m", { n: m });
  }
  const h = Math.floor(m / 60);
  if (h < 24) {
    return suffix
      ? t("time.hAgo", "{n}h ago", { n: h })
      : t("time.h", "{n}h", { n: h });
  }
  const d = Math.floor(h / 24);
  if (d < 7) {
    return suffix
      ? t("time.dAgo", "{n}d ago", { n: d })
      : t("time.d", "{n}d", { n: d });
  }
  const w = Math.floor(d / 7);
  if (w < 5) {
    return suffix
      ? t("time.wAgo", "{n}w ago", { n: w })
      : t("time.w", "{n}w", { n: w });
  }
  const mo = Math.floor(d / 30);
  if (mo < 12) {
    return suffix
      ? t("time.moAgo", "{n}mo ago", { n: mo })
      : t("time.mo", "{n}mo", { n: mo });
  }
  const y = Math.floor(mo / 12);
  return suffix
    ? t("time.yAgo", "{n}y ago", { n: y })
    : t("time.y", "{n}y", { n: y });
}

/** The absolute date, for anything older than the ladder above. */
export function shortDate(iso: string): string {
  const then = new Date(iso).getTime();
  return Number.isFinite(then) ? FORMAT.format(new Date(iso)) : "";
}
