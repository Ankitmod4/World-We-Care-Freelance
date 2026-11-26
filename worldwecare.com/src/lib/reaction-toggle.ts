/**
 * The one place that decides what a reaction tap MEANS.
 *
 * Six surfaces carry reactions now — posts, confessions, gratitude,
 * articles, clips and petitions — and each one writes to its own table
 * with its own counter column. What they share is the part that is
 * easy to get wrong:
 *
 *   • nothing → something   a row appears, the count goes UP
 *   • something → a different one   the row changes type, the count
 *                           DOES NOT MOVE
 *   • something → the same one   the row goes, the count goes DOWN
 *
 * That middle case is the whole reason this file exists. Written out
 * six times, at least one copy would eventually increment on a change
 * and the counter would drift away from the rows with nothing to
 * catch it. Here it is decided once and tested once; each caller still
 * does its own writes, because the counter column and the notification
 * differ per surface and hiding those behind a generic helper would
 * cost more clarity than it saved.
 *
 * NO IMPORTS FROM PRISMA. This is pure, so it can be unit-tested
 * without a database, same reason reactions.ts has no imports.
 */

import { cleanReaction, type ReactionType } from "./reactions";

export type ReactionOutcome =
  /** No row yet. Insert one, and move the counter up. */
  | { kind: "added"; type: ReactionType }
  /** A row exists with a different type. Change it, and DO NOT touch the counter. */
  | { kind: "changed"; type: ReactionType; from: ReactionType }
  /** The same one again — they are taking it back. Delete, counter down. */
  | { kind: "removed"; type: ReactionType };

/**
 * `existing` is the type already stored for this person, or null.
 * `raw` is whatever the client sent: anything unrecognised becomes
 * LIKE rather than an error, so an old client that sends no body at
 * all keeps behaving exactly like the like button it used to be.
 */
export function reactionOutcome(
  existing: ReactionType | null,
  raw: unknown,
): ReactionOutcome {
  const type = cleanReaction(raw) ?? "LIKE";
  if (!existing) return { kind: "added", type };
  if (existing === type) return { kind: "removed", type };
  return { kind: "changed", type, from: existing };
}

/** True when the surface's counter should move, and which way. */
export function counterDelta(outcome: ReactionOutcome): -1 | 0 | 1 {
  return outcome.kind === "added" ? 1 : outcome.kind === "removed" ? -1 : 0;
}

/**
 * Whether this outcome should notify the author.
 *
 * Only a genuinely new reaction does. Changing your mind from 👍 to 🤗
 * is not a second event in the author's life, and taking one back is
 * certainly not something to tell them about.
 */
export function shouldNotify(outcome: ReactionOutcome): boolean {
  return outcome.kind === "added";
}

/** How each reaction reads in a notification sentence. */
export const REACTION_VERB: Record<ReactionType, string> = {
  LIKE: "liked",
  HEART: "loved",
  CARE: "sent love on",
  STRENGTH: "is rooting for you on",
  PROUD: "is proud of",
  SAME: "said “same here” on",
};

/* ── comments ───────────────────────────────────────────────── */

/**
 * The shape every comment surface returns, and the one line of logic
 * they share beyond `reactionOutcome`.
 *
 * WHY THERE IS NO GENERIC `toggleCommentReaction` HERE. There was one,
 * taking the two Prisma delegates as arguments. Prisma's delegate
 * types are contravariant in their argument, so the parameter had to
 * be `any` to accept five different tables — and there is not a single
 * `any` anywhere else in src/lib. Five explicit ten-line functions,
 * each calling the shared `reactionOutcome`, are more honest than one
 * abstraction bought with a hole in the type system. The part that was
 * actually worth sharing — deciding what a tap means — already is.
 *
 * All five surfaces RECOUNT rather than increment, which is what makes
 * those ten lines trivially correct: with `likeCount` derived from the
 * rows, the "changed their mind" case needs no special handling, since
 * one person still holds exactly one row either way.
 */
export function commentReactionResult(
  outcome: ReactionOutcome,
  likeCount: number,
): { liked: boolean; likeCount: number; myReaction: ReactionType | null } {
  return {
    liked: outcome.kind !== "removed",
    likeCount,
    myReaction: outcome.kind === "removed" ? null : outcome.type,
  };
}
