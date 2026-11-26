/**
 * The report reasons, on their own.
 *
 * Split out from `place-reports.ts` because the modal that shows these
 * is a client component, and that file reaches for Prisma the moment it
 * is imported. Constants and one type import in here: no db.
 */

import type { TFunction } from "./i18n-core";

export const PLACE_REPORT_KINDS = [
  { value: "CLOSED_DOWN", label: "It has closed down" },
  { value: "MOVED", label: "It has moved" },
  { value: "WRONG_DETAILS", label: "The details are wrong" },
  { value: "DUPLICATE", label: "It's listed twice" },
  { value: "NOT_APPROPRIATE", label: "It doesn't belong here" },
  { value: "OTHER", label: "Something else" },
] as const;

export type PlaceReportKindValue = (typeof PLACE_REPORT_KINDS)[number]["value"];

/**
 * The same reasons, translated.
 *
 * LITERAL `t()` CALLS: the extractor reads the source for calls whose
 * key it can see, so `t(kind.labelKey, kind.label)` would never reach
 * the catalogue. The table above stays as the enum contract (and is
 * what the admin list reads, untranslated); this is what the member
 * sees. See header-nav for the same pattern.
 */
export function placeReportKinds(
  t: TFunction,
): Array<{ value: PlaceReportKindValue; label: string }> {
  return [
    { value: "CLOSED_DOWN", label: t("placeReport.closed", "It has closed down") },
    { value: "MOVED", label: t("placeReport.moved", "It has moved") },
    { value: "WRONG_DETAILS", label: t("placeReport.wrongDetails", "The details are wrong") },
    { value: "DUPLICATE", label: t("placeReport.duplicate", "It's listed twice") },
    { value: "NOT_APPROPRIATE", label: t("placeReport.notAppropriate", "It doesn't belong here") },
    { value: "OTHER", label: t("placeReport.other", "Something else") },
  ];
}

export function isReportKind(v: unknown): v is PlaceReportKindValue {
  return PLACE_REPORT_KINDS.some((k) => k.value === v);
}

export function reportKindLabel(kind: string): string {
  return PLACE_REPORT_KINDS.find((k) => k.value === kind)?.label ?? "Reported";
}
