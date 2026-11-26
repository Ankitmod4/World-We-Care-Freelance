/**
 * Turning a flat list of chat messages into turns.
 *
 * Every message used to carry its own avatar, name, timestamp and a
 * permanently visible "⋯ Reply 😊 26d ago" strip. Four messages from
 * one person inside a minute meant four faces, four names and four
 * action rows — which is most of why a room read as a form rather
 * than a conversation.
 *
 * A run from the same person inside GROUP_WINDOW_MS is one turn: the
 * name and avatar appear once at the top of it, the time once at the
 * bottom, and a divider names each new day.
 *
 * THE ONE RULE THAT IS NOT OBVIOUS: anonymous messages never group.
 * Two different people posting anonymously are indistinguishable here
 * — `authorId` is masked to null on purpose — so joining them into
 * one turn would put one person's words under another's.
 */

/** Messages closer together than this from one person read as one turn. */
export const GROUP_WINDOW_MS = 5 * 60 * 1000;

export interface Groupable {
  authorId: string | null;
  isAnonymous: boolean;
  isOwn: boolean;
  createdAt: string;
  replyTo?: unknown;
}

export interface GroupedRow<T> {
  m: T;
  /** First message of a new calendar day — draw a divider above it. */
  newDay: boolean;
  /** Same person, moments ago — no avatar, no name repeated. */
  continues: boolean;
  /** Last of its turn — the one that carries the timestamp. */
  endsTurn: boolean;
}

/** Local calendar day. The room is read where the reader is. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function joins(a: Groupable | undefined, b: Groupable | undefined): boolean {
  if (!a || !b) return false;
  if (a.isAnonymous || b.isAnonymous) return false;
  if (a.isOwn !== b.isOwn || a.authorId !== b.authorId) return false;
  if (b.replyTo) return false; // a reply opens its own turn
  if (dayKey(a.createdAt) !== dayKey(b.createdAt)) return false;

  const gap = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (!Number.isFinite(gap)) return false;
  return Math.abs(gap) < GROUP_WINDOW_MS;
}

export function groupMessages<T extends Groupable>(messages: T[]): GroupedRow<T>[] {
  return messages.map((m, i) => ({
    m,
    newDay: i === 0 || dayKey(messages[i - 1].createdAt) !== dayKey(m.createdAt),
    continues: joins(messages[i - 1], m),
    endsTurn: !joins(m, messages[i + 1]),
  }));
}
