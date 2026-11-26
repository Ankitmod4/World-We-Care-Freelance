/**
 * What each badge is called, in the reader's language.
 *
 * A SWITCH RATHER THAN A LOOKUP TABLE, and the reason is the same one
 * that made `time-ago` ship a fully translated page stamped "4w ago":
 * `t(`badge.${slug}.name`, b.name)` typechecks, reads better than
 * this, and is INVISIBLE to `i18n:extract` — so not one of these
 * would ever reach the catalogue, and every badge would stay English
 * however many times somebody pressed Fill gaps. The scanner reads
 * literals, so literals is what it gets.
 *
 * No prisma import, so a client component can use it.
 */

import type { TFunction } from "./i18n-core";

/**
 * `description` is optional because half the callers do not have one.
 *
 * The sidebar shows six badge emoji with the name as a tooltip and
 * never loads the sentence; requiring it would have meant either
 * widening that query for a string nobody renders, or leaving the
 * tooltips in English. Neither is worth it for a field this function
 * returns rather than needs.
 */
export function badgeText(
  t: TFunction,
  badge: { slug: string; name: string; description?: string },
): { name: string; description: string } {
  switch (badge.slug) {
    case "sober-30":
      return {
        name: t("badge.sober30.name", "Thirty days"),
        description: t("badge.sober30.desc", "Thirty days on your sobriety streak."),
      };
    case "sober-90":
      return {
        name: t("badge.sober90.name", "Ninety days"),
        description: t("badge.sober90.desc", "Ninety days. That is a season of your life."),
      };
    case "sober-365":
      return {
        name: t("badge.sober365.name", "A year"),
        description: t("badge.sober365.desc", "A full year sober."),
      };
    case "started-again":
      return {
        name: t("badge.startedAgain.name", "Started again"),
        description: t("badge.startedAgain.desc", "You reset a streak and kept going. That is the hard part."),
      };
    case "first-entry":
      return {
        name: t("badge.firstEntry.name", "First words"),
        description: t("badge.firstEntry.desc", "You wrote your first private journal entry."),
      };
    case "journal-30":
      return {
        name: t("badge.journal30.name", "Thirty entries"),
        description: t("badge.journal30.desc", "Thirty entries in your journal."),
      };
    case "opened-up":
      return {
        name: t("badge.openedUp.name", "Opened up"),
        description: t("badge.openedUp.desc", "You shared something from your journal."),
      };
    case "grateful-10":
      return {
        name: t("badge.grateful10.name", "Ten gratitudes"),
        description: t("badge.grateful10.desc", "Ten posts on the gratitude wall."),
      };
    case "first-post":
      return {
        name: t("badge.firstPost.name", "Said hello"),
        description: t("badge.firstPost.desc", "Your first post in the community."),
      };
    case "first-reply":
      return {
        name: t("badge.firstReply.name", "First reply"),
        description: t("badge.firstReply.desc", "You answered somebody."),
      };
    case "crisis-responder":
      return {
        name: t("badge.crisisResponder.name", "There at 2am"),
        description: t("badge.crisisResponder.desc", "You replied in a crisis room."),
      };
    case "hero-spotter":
      return {
        name: t("badge.heroSpotter.name", "Hero spotter"),
        description: t("badge.heroSpotter.desc", "A Town Hero you nominated was published."),
      };
    case "showed-up":
      return {
        name: t("badge.showedUp.name", "Showed up"),
        description: t("badge.showedUp.desc", "You said yes to a real event."),
      };
    case "petition-starter":
      return {
        name: t("badge.petitionStarter.name", "Asked for change"),
        description: t("badge.petitionStarter.desc", "You started a petition."),
      };
    case "gave":
      return {
        name: t("badge.gave.name", "Gave"),
        description: t("badge.gave.desc", "You supported a cause with a donation."),
      };
    default:
      // A badge added to the list but not to this switch still
      // renders — in English, which is what it was before.
      return { name: badge.name, description: badge.description ?? "" };
  }
}
