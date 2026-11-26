/**
 * The reaction set, and the words that go with it.
 *
 * NO IMPORTS. Both the server and the post card need this, and the
 * card is a client component — anything pulled in here would be
 * pulled into the browser bundle with it. Same reason `money.ts`
 * exists separately from `payments.ts`.
 *
 * WHY THESE SIX. A support community is not a food blog: the reaction
 * a person wants under "I drank last night" is not a thumbs-up. The
 * set is what you would want said back to you —
 *
 *   • Same here    the most valuable thing on the site. "You are not
 *                  the only one", said without having to write a reply
 *                  you are not ready to write.
 *   • Sending love for the posts where there is nothing to fix.
 *   • You've got this for the ones where there is.
 *   • Proud of you for a milestone somebody was brave to name.
 *
 * There is deliberately no "angry" and no "sad". A frowning face under
 * somebody's worst day reads as a stranger agreeing it is hopeless.
 */

export type ReactionType = "LIKE" | "HEART" | "CARE" | "STRENGTH" | "PROUD" | "SAME";

export interface ReactionDef {
  type: ReactionType;
  emoji: string;
  /** On the button and in the picker's tooltip. */
  label: string;
  /** Read out to screen readers — the emoji alone says nothing. */
  aria: string;
}

/** Order here is the order in the picker. */
export const REACTIONS: ReactionDef[] = [
  { type: "LIKE", emoji: "\u{1F44D}", label: "Like", aria: "Like this post" },
  { type: "HEART", emoji: "\u{2764}\u{FE0F}", label: "Love", aria: "Love this post" },
  { type: "CARE", emoji: "\u{1F917}", label: "Sending love", aria: "Send love" },
  { type: "STRENGTH", emoji: "\u{1F4AA}", label: "You've got this", aria: "You've got this" },
  { type: "PROUD", emoji: "\u{1F31F}", label: "Proud of you", aria: "Proud of you" },
  { type: "SAME", emoji: "\u{1F64B}", label: "Same here", aria: "Same here — me too" },
];

export const REACTION_BY_TYPE: Record<ReactionType, ReactionDef> = Object.fromEntries(
  REACTIONS.map((r) => [r.type, r]),
) as Record<ReactionType, ReactionDef>;

export const REACTION_TYPES = REACTIONS.map((r) => r.type);

/** Unknown strings become null rather than throwing — a client can send anything. */
export function cleanReaction(raw: unknown): ReactionType | null {
  return typeof raw === "string" && (REACTION_TYPES as string[]).includes(raw)
    ? (raw as ReactionType)
    : null;
}
