/**
 * Keyset cursors that survive a timestamp tie.
 *
 * THE BUG THIS FIXES. Chat messages and live-stream comments paged on
 * `createdAt` alone with a strict comparison:
 *
 *     where: { createdAt: { lt: new Date(before) } }
 *
 * `createdAt` is DATETIME(3) — millisecond precision — and in a busy
 * room two people genuinely do land in the same millisecond. When that
 * happened at a page boundary, the sibling sharing the boundary
 * timestamp was not merely reordered, it was SKIPPED: the next page
 * started strictly below that millisecond, so the message never
 * appeared and scrolling further never brought it back. The `after`
 * path had the mirror problem, silently dropping a live message.
 *
 * The feed and DMs already paged on `(createdAt, id)` together. This
 * is the same thing, shared, so the two places that were still doing
 * it by timestamp alone can stop.
 *
 * WIRE FORMAT: "<iso>|<id>". A bare "<iso>" still parses, with a null
 * id and the old strict-inequality behaviour — so cursors already held
 * by an open tab keep working across the deploy instead of erroring or
 * silently restarting the conversation.
 */

export interface Cursor {
  at: Date;
  /** Null for a legacy timestamp-only cursor. */
  id: string | null;
}

export function encodeCursor(at: Date, id: string): string {
  return `${at.toISOString()}|${id}`;
}

export function parseCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null;
  const bar = raw.indexOf("|");
  const iso = bar === -1 ? raw : raw.slice(0, bar);
  const id = bar === -1 ? null : raw.slice(bar + 1) || null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return { at, id };
}

/** Strictly before the cursor, ties broken by id. Pair with `orderBy: [{createdAt:"desc"},{id:"desc"}]`. */
export function olderThan(c: Cursor) {
  if (!c.id) return { createdAt: { lt: c.at } };
  return {
    OR: [{ createdAt: { lt: c.at } }, { createdAt: c.at, id: { lt: c.id } }],
  };
}

/** Strictly after the cursor, ties broken by id. Pair with `orderBy: [{createdAt:"asc"},{id:"asc"}]`. */
export function newerThan(c: Cursor) {
  if (!c.id) return { createdAt: { gt: c.at } };
  return {
    OR: [{ createdAt: { gt: c.at } }, { createdAt: c.at, id: { gt: c.id } }],
  };
}
