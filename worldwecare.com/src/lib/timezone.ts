/**
 * Timezone helpers for events.
 *
 * An organiser types a wall-clock time ("7:00pm") and picks the zone
 * it belongs to ("America/New_York"). We store a UTC instant plus the
 * IANA zone, then always render back in that zone — so a Chicago
 * reader sees a New York meetup at its New York time, which is what
 * actually gets them to the door.
 *
 * No dependency: `Intl` already knows every zone and every DST rule.
 */

/** Milliseconds the zone is ahead of UTC at that instant. */
function offsetAt(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  // `hour` comes back as "24" at midnight in some engines.
  const hour = p.hour === "24" ? 0 : Number(p.hour);
  const asIfUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    hour,
    Number(p.minute),
    Number(p.second),
  );
  return asIfUtc - date.getTime();
}

/**
 * Convert a wall-clock string ("2026-09-01T19:00") in `timeZone` into
 * the matching UTC instant.
 *
 * Two passes: the first guess uses the offset at the *wrong* instant,
 * which is off by an hour across a DST boundary; re-measuring at the
 * corrected instant fixes it. Returns null for unparseable input.
 */
export function zonedToUtc(localWallClock: string, timeZone: string): Date | null {
  if (!localWallClock) return null;
  const asUtc = new Date(`${localWallClock.length === 16 ? `${localWallClock}:00` : localWallClock}Z`);
  if (Number.isNaN(asUtc.getTime())) return null;
  try {
    let instant = new Date(asUtc.getTime() - offsetAt(asUtc, timeZone));
    instant = new Date(asUtc.getTime() - offsetAt(instant, timeZone));
    return instant;
  } catch {
    return null;
  }
}

/**
 * The inverse: a UTC instant rendered as a wall-clock string in
 * `timeZone`, in the format `<input type="datetime-local">` expects.
 */
export function utcToZonedInput(date: Date | string, timeZone: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  try {
    const dtf = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const p: Record<string, string> = {};
    for (const part of dtf.formatToParts(d)) p[part.type] = part.value;
    const hour = p.hour === "24" ? "00" : p.hour;
    return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`;
  } catch {
    return "";
  }
}

/** Human-readable event time, always in the event's own zone. */
export function formatEventTime(
  date: Date | string,
  timeZone: string,
  opts: { withZone?: boolean; dateOnly?: boolean } = {},
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      ...(opts.dateOnly ? {} : { hour: "numeric", minute: "2-digit" }),
      ...(opts.withZone ? { timeZoneName: "short" } : {}),
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

/**
 * The pieces of a date, already converted into the event's zone, for
 * layouts that need them separately — a calendar-style date chip needs
 * the day number on its own line, which a formatted string can't give
 * you without string surgery.
 *
 * `dayKey` is a stable YYYY-MM-DD in that same zone, safe to group by.
 */
export function eventDateParts(
  date: Date | string,
  timeZone: string,
): { day: string; month: string; weekday: string; time: string; zone: string; dayKey: string } {
  const d = typeof date === "string" ? new Date(date) : date;
  const empty = { day: "", month: "", weekday: "", time: "", zone: "", dayKey: "" };
  if (Number.isNaN(d.getTime())) return empty;

  // A junk zone on an old row shouldn't blank out the whole date chip;
  // fall back to UTC the way `formatEventTime` falls back to an ISO
  // string.
  const part = (opts: Intl.DateTimeFormatOptions, locale?: string) => {
    try {
      return new Intl.DateTimeFormat(locale, { timeZone, ...opts }).format(d);
    } catch {
      try {
        return new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...opts }).format(d);
      } catch {
        return "";
      }
    }
  };

  // The zone abbreviation is the trailing token of a time+zone render;
  // formatToParts gives it directly, without guessing at separators.
  let zone = "";
  try {
    zone =
      new Intl.DateTimeFormat(undefined, { timeZone, timeZoneName: "short" })
        .formatToParts(d)
        .find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    zone = "UTC";
  }

  return {
    day: part({ day: "numeric" }),
    month: part({ month: "short" }),
    weekday: part({ weekday: "short" }),
    time: part({ hour: "numeric", minute: "2-digit" }),
    zone,
    // en-CA gives ISO-ordered numeric dates, so string comparison and
    // equality both behave.
    dayKey: part({ year: "numeric", month: "2-digit", day: "2-digit" }, "en-CA"),
  };
}

/**
 * A plain calendar date, formatted IDENTICALLY on the server and in
 * the browser.
 *
 * `toLocaleDateString()` with no arguments uses whatever locale the
 * runtime defaults to — Node on the server, the user's browser on the
 * client — so the same date renders "25/08/2026" during SSR and
 * "25/8/2026" after hydration, and React throws a mismatch. Both the
 * locale and the zone are therefore pinned.
 *
 * UTC is the right zone here, not the reader's: these dates come from
 * `<input type="date">` and are stored at midnight UTC, so rendering
 * them locally would show the previous day to anyone west of London.
 *
 * A named month also sidesteps the DD/MM versus MM/DD ambiguity that
 * makes a numeric date unreadable to half the world.
 */
export function formatDayUTC(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * "25 Aug – 8 Oct 2026", dropping the repeated year and handling an
 * open-ended range from either side.
 */
export function formatDayRangeUTC(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): string {
  const from = formatDayUTC(start);
  const to = formatDayUTC(end);
  if (from && to) {
    const fromYear = from.slice(-4);
    // Same year: "25 Aug – 8 Oct 2026" rather than repeating it.
    return fromYear === to.slice(-4) ? `${from.slice(0, -5)} – ${to}` : `${from} – ${to}`;
  }
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return "";
}

/** The viewer's own zone, for defaulting the picker. */
export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Every zone the runtime knows, for the picker. Falls back to a short
 * list on engines without `supportedValuesOf`.
 */
export function allZones(): string[] {
  try {
    const withValues = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    const zones = withValues.supportedValuesOf?.("timeZone");
    if (zones?.length) return zones;
  } catch {
    /* fall through */
  }
  return [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Berlin",
    "Asia/Kolkata",
    "Asia/Dubai",
    "Australia/Sydney",
  ];
}
