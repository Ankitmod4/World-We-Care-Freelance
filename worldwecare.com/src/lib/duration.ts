/**
 * Seconds as a clock, once.
 *
 * There were three copies of this arithmetic: the player's scrubber
 * readout, the clip card's corner badge, and — nearly — a fourth for
 * the video badge on the gratitude and confession walls. Writing the
 * fourth is what made the drift worth fixing, because the copies had
 * ALREADY diverged: the clip card's version divided by 60 without
 * taking the remainder, so a 90-minute recording read "90:00" instead
 * of "1:30:00". Nobody noticed, because most clips are short.
 *
 * TWO ENTRY POINTS, ONE PIECE OF ARITHMETIC. They differ in what they
 * do with a number they cannot use, and that difference is real:
 *
 *   • `clockDuration` ALWAYS returns a string. It is the player's
 *     readout, and a readout that vanishes mid-playback is worse than
 *     one that says 0:00.
 *
 *   • `durationBadge` returns null instead. It is a badge over a
 *     thumbnail, and a badge reading "0:00" over a video that plays
 *     for ten seconds is a lie — better to show nothing when the
 *     duration was never probed.
 *
 * NO LOCALE ARGUMENT, deliberately. A colon-separated clock is
 * near-universal, these are digits either way, and the alternative is
 * `Intl.NumberFormat` per segment for a string that is read at a
 * glance. The numerals are rendered with `tabular-nums` so the badge
 * does not jitter as the seconds change.
 */

/**
 * Always a string. Hours appear only when there are any, and the
 * minutes are zero-padded only then — "4:07" on its own, but
 * "1:04:07" once an hour is in front of it, because "1:4:07" is not a
 * clock.
 */
export function clockDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  // `floor`, not `round`. Rounding makes a 3.6-second clip read "0:04"
  // and a 59.7-second one "1:00", both of which name a moment the
  // video never reaches.
  const total = Math.floor(seconds);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/**
 * A badge, or nothing.
 *
 * Null for a missing, unusable or zero duration — a video whose length
 * was never probed gets no badge rather than a wrong one. Note that
 * zero is excluded as well as null: a READY asset always has a real
 * duration, so a 0 here means the probe failed.
 */
export function durationBadge(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return clockDuration(seconds);
}
