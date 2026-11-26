/**
 * What each reaction is called, in the reader's language.
 *
 * Six labels and six aria strings, sitting under every post on the
 * site — and English on a Russian page, because they live in a plain
 * array in `reactions.ts` read through a lookup, which is precisely
 * the shape the leftover-scanner could not see and `t()` cannot reach.
 *
 * Written out as a switch, for the reason in `badge-text.ts`: a
 * computed key is invisible to `i18n:extract`, so none of these would
 * ever reach the catalogue.
 *
 * No prisma import, so a client component can use it.
 */

import type { TFunction } from "./i18n-core";

export function reactionLabel(t: TFunction, type: string): string {
  switch (type) {
    case "LIKE":
      return t("reaction.like", "Like");
    case "HEART":
      return t("reaction.love", "Love");
    case "CARE":
      return t("reaction.care", "Sending love");
    case "STRENGTH":
      return t("reaction.strength", "You've got this");
    case "PROUD":
      return t("reaction.proud", "Proud of you");
    case "SAME":
      return t("reaction.same", "Same here");
    default:
      return t("reaction.generic", "React");
  }
}

/** The longer form a screen reader announces. */
export function reactionAria(t: TFunction, type: string): string {
  switch (type) {
    case "LIKE":
      return t("reaction.likeAria", "Like this post");
    case "HEART":
      return t("reaction.loveAria", "Love this post");
    case "CARE":
      return t("reaction.careAria", "Send love");
    case "STRENGTH":
      return t("reaction.strengthAria", "You've got this");
    case "PROUD":
      return t("reaction.proudAria", "Proud of you");
    case "SAME":
      return t("reaction.sameAria", "Same here — me too");
    default:
      return t("reaction.genericAria", "React to this post");
  }
}
