/**
 * What each kind of place is called, in the reader's language.
 *
 * ── WHY THESE WERE STILL ENGLISH ──
 *
 * They live in a plain array in `places.ts` and are read through
 * `placeTypeLabel(type)`, which takes no translator and cannot have
 * one: it is called from server code, from the map, and from card
 * rows. Nothing about that is unusual — and it is exactly why the
 * leftover-scanner missed them for so long, because it only walked
 * `.tsx` files and every one of these sentences lives in a `.ts`.
 *
 * So the English stays in `places.ts`, where the slugs and colours
 * and the seed data need it, and the WORDS come from here.
 *
 * A SWITCH, NOT A LOOKUP, for the reason written out at length in
 * `badge-text.ts`: `t(`place.${slug}`, …)` compiles, reads better,
 * and is invisible to `i18n:extract`, so not one of these would ever
 * reach the catalogue.
 *
 * No prisma import, so a client component can use it.
 */

import type { TFunction } from "./i18n-core";

export function placeKindLabel(t: TFunction, type: string): string {
  switch (type) {
    case "RECOVERY_PROGRAM":
      return t("placeKind.recoveryProgram", "Recovery program");
    case "CLINIC":
      return t("placeKind.clinic", "Clinic");
    case "COUNSELLING":
      return t("placeKind.counselling", "Counselling");
    case "CHURCH":
      return t("placeKind.church", "Church or faith group");
    case "FOOD_BANK":
      return t("placeKind.foodBank", "Food bank");
    case "ANIMAL_SHELTER":
      return t("placeKind.animalShelter", "Animal shelter");
    case "SHELTER":
      return t("placeKind.shelter", "Shelter or housing");
    case "COMMUNITY_CENTRE":
      return t("placeKind.communityCentre", "Community centre");
    case "DONATING_BUSINESS":
      return t("placeKind.donatingBusiness", "Donating business");
    case "OTHER":
      return t("placeKind.other", "Other");
    default:
      return t("placeKind.fallback", "Place");
  }
}

/** The line under the name on a category tile. */
export function placeKindBlurb(t: TFunction, type: string): string {
  switch (type) {
    case "RECOVERY_PROGRAM":
      return t("placeKind.recoveryProgramBlurb", "Meetings, treatment and the people who run them.");
    case "CLINIC":
      return t("placeKind.clinicBlurb", "Walk-in care, prescriptions and testing.");
    case "COUNSELLING":
      return t("placeKind.counsellingBlurb", "Talking therapy, one to one or in a group.");
    case "CHURCH":
      return t("placeKind.churchBlurb", "Congregations and the help they hand out.");
    case "FOOD_BANK":
      return t("placeKind.foodBankBlurb", "Parcels, pantries and hot meals.");
    case "ANIMAL_SHELTER":
      return t("placeKind.animalShelterBlurb", "Rescues, fosters and somewhere to volunteer.");
    case "SHELTER":
      return t("placeKind.shelterBlurb", "A bed tonight, and help finding one for longer.");
    case "COMMUNITY_CENTRE":
      return t("placeKind.communityCentreBlurb", "Halls, groups and noticeboards worth reading.");
    case "DONATING_BUSINESS":
      return t("placeKind.donatingBusinessBlurb", "Local shops putting something back.");
    case "OTHER":
      return t("placeKind.otherBlurb", "Everything that doesn't fit the rest.");
    default:
      return "";
  }
}
