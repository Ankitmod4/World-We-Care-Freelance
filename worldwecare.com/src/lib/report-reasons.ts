/**
 * The reasons somebody can report something, in one place.
 *
 * THEY WERE IN THREE FILES. The post report modal had label + hint,
 * the chatroom's had label only, and the admin list had its own copy
 * with a colour — three lists that had to agree about eight enum
 * values and did not have to agree about their wording, which is how
 * "Off-topic" and "Off topic" end up on the same site.
 *
 * LITERAL `t()` CALLS, not a table of strings looked up by key.
 * `scripts/extract-strings.ts` reads the source for calls whose key it
 * can see; `t(reason.labelKey, reason.label)` is invisible to it, so a
 * reasons list built that way would never reach the catalogue and
 * never get translated. Same pattern as header-nav.
 */

import type { TFunction } from "./i18n-core";

export const REPORT_REASONS = [
  "SPAM",
  "HARASSMENT",
  "HATE_SPEECH",
  "SELF_HARM",
  "ADULT_CONTENT",
  "MISINFORMATION",
  "OFF_TOPIC",
  "OTHER",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export function reportReasons(
  t: TFunction,
): Array<{ value: ReportReason; label: string; hint: string }> {
  return [
    {
      value: "SPAM",
      label: t("report.spam", "Spam"),
      hint: t("report.spamHint", "Ads, scams, off-topic promotion."),
    },
    {
      value: "HARASSMENT",
      label: t("report.harassment", "Harassment"),
      hint: t("report.harassmentHint", "Targeting someone with hostility."),
    },
    {
      value: "HATE_SPEECH",
      label: t("report.hateSpeech", "Hate speech"),
      hint: t("report.hateSpeechHint", "Attacking people for who they are."),
    },
    {
      value: "SELF_HARM",
      label: t("report.selfHarm", "Self-harm"),
      hint: t("report.selfHarmHint", "Encourages or celebrates hurting oneself."),
    },
    {
      value: "ADULT_CONTENT",
      label: t("report.adultContent", "Adult content"),
      hint: t("report.adultContentHint", "Explicit material."),
    },
    {
      value: "MISINFORMATION",
      label: t("report.misinformation", "Misinformation"),
      hint: t("report.misinformationHint", "False or misleading claim."),
    },
    {
      value: "OFF_TOPIC",
      label: t("report.offTopic", "Off-topic"),
      hint: t("report.offTopicHint", "Doesn't belong on this wall."),
    },
    {
      value: "OTHER",
      label: t("report.other", "Other"),
      hint: t("report.otherHint", "Something else."),
    },
  ];
}
