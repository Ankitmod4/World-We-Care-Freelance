/**
 * Why somebody is in "Who to follow", as data rather than a sentence.
 *
 * The reason used to be built server-side as English prose ("Also in
 * Sobriety", "Followed by 3 people you follow"). That is fine until
 * the reader has picked another language, at which point the whole
 * card is translated except the one line that explains it.
 *
 * So the server now returns a shape — a kind, a count, a room name —
 * and the words are assembled in the browser, where `t()` is. The
 * room name itself is NOT translated: it is content somebody typed,
 * and machine-rewriting a room's name would change what the reader is
 * being told they are a member of.
 */

import type { TFunction } from "./i18n-core";

export type FollowReason =
  /*
     `roomId` travels beside the name so the browser can translate it.

     "Also in Alcohol & Drug Recovery" arrived with the sentence in
     Russian and the room still in English, which is the worst of
     both — it reads as a bug rather than as a name left alone on
     purpose. The room's own name IS translated everywhere else on the
     site, so it has to be here too.
  */
  | { kind: "sharedRoom"; room: string; roomId: string }
  | { kind: "sharedRooms"; n: number }
  | { kind: "followedByOne" }
  | { kind: "followedByMany"; n: number }
  | { kind: "postingThisWeek" }
  | { kind: "newHere" };

export function followReasonText(t: TFunction, r: FollowReason): string {
  switch (r.kind) {
    case "sharedRoom":
      return t("follow.reason.sharedRoom", "Also in {room}", { room: r.room });
    case "sharedRooms":
      return t("follow.reason.sharedRooms", "In {n} of your rooms", { n: r.n });
    case "followedByOne":
      return t("follow.reason.followedByOne", "Followed by someone you follow");
    case "followedByMany":
      return t("follow.reason.followedByMany", "Followed by {n} people you follow", {
        n: r.n,
      });
    case "postingThisWeek":
      return t("follow.reason.postingThisWeek", "Posting this week");
    default:
      return t("follow.reason.newHere", "New here too");
  }
}
