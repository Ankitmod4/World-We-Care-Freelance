/**
 * User-side post actions — right now just reporting. Grows as we
 * add: create post, like, save, comment.
 *
 * `reportPost` is the single call that turns a user's "flag" tap
 * into all four things we care about:
 *   1. Insert a PostReport row.
 *   2. Bump the target's `reportCount` denorm so the admin list
 *      shows the correct chip without a join.
 *   3. Silently no-op if this reporter already has an OPEN report
 *      against the same target (so refresh + double-tap doesn't
 *      inflate the queue).
 *   4. Fan out an AdminNotification to every active admin so the
 *      bell + sidebar badge light up in near real-time.
 *
 * All four happen in a single Prisma transaction so a partial
 * failure never leaves the counters and the report table out of
 * sync. The notification fan-out is deliberately outside the
 * transaction — its own helper already swallows failures so it
 * can never roll back the report itself.
 */

import type { Prisma, ReportReason } from "@prisma/client";
import { ReportStatus, ReportTargetType } from "@prisma/client";
import { prisma } from "./db";
import { createForAllAdmins } from "./admin-notifications";

export interface ReportInput {
  postId: string;
  commentId?: string;
  reporterId: string;
  reason: ReportReason;
  notes?: string;
}

export interface ReportOutcome {
  ok: boolean;
  id: string | null;
  duplicate: boolean;
}

/**
 * Files a report. Returns { duplicate: true } silently when the
 * reporter has already flagged this target — safe to call from a
 * client without extra deduping logic.
 */
export async function reportPost(input: ReportInput): Promise<ReportOutcome> {
  const targetType: ReportTargetType = input.commentId
    ? ReportTargetType.COMMENT
    : ReportTargetType.POST;

  // Verify the target exists before we do anything else. Cheaper
  // than a failed insert and gives us the author's snapshot for
  // the notification title.
  const post = await prisma.post.findUnique({
    where: { id: input.postId },
    select: {
      id: true,
      authorNameSnapshot: true,
      isAnonymous: true,
      body: true,
    },
  });
  if (!post) throw new Error("Post not found");

  let commentAuthorName: string | null = null;
  if (input.commentId) {
    const c = await prisma.postComment.findUnique({
      where: { id: input.commentId },
      select: { id: true, postId: true, authorNameSnapshot: true, isAnonymous: true },
    });
    if (!c || c.postId !== input.postId) throw new Error("Comment not found");
    commentAuthorName = c.isAnonymous ? "an anonymous member" : c.authorNameSnapshot;
  }

  // While a report is open it carries an `openKey`, and the database
  // has a unique index on (reporterId, openKey). That constraint is
  // what actually prevents a double-file — this lookup only exists so
  // the common case (someone pressing report twice, seconds apart)
  // answers "already reported" instead of throwing.
  const openKey = input.commentId
    ? `COMMENT:${input.commentId}`
    : `POST:${input.postId}`;

  const dupe = await prisma.postReport.findFirst({
    where: { reporterId: input.reporterId, openKey, status: ReportStatus.OPEN },
    select: { id: true },
  });
  if (dupe) {
    return { ok: true, id: dupe.id, duplicate: true };
  }

  // Insert + set the counter atomically.
  let report;
  try {
    [report] = await prisma.$transaction([
      prisma.postReport.create({
        data: {
          targetType,
          postId: input.postId,
          commentId: input.commentId ?? null,
          reporterId: input.reporterId,
          reason: input.reason,
          notes: input.notes?.trim() || null,
          openKey,
        },
      }),
      input.commentId
        ? prisma.postComment.update({
            where: { id: input.commentId },
            data: { reportCount: { increment: 1 } },
          })
        : prisma.post.update({
            where: { id: input.postId },
            data: { reportCount: { increment: 1 } },
          }),
    ]);
  } catch (err) {
    // P2002 = the unique index caught a second submission that got past
    // the lookup above, which is exactly the double-click this is for.
    // The first one won; report success on the row that exists.
    if (
      typeof err === "object" && err !== null &&
      (err as { code?: string }).code === "P2002"
    ) {
      const existing = await prisma.postReport.findFirst({
        where: { reporterId: input.reporterId, openKey, status: ReportStatus.OPEN },
        select: { id: true },
      });
      if (existing) return { ok: true, id: existing.id, duplicate: true };
    }
    throw err;
  }

  // Fan out to admins — best-effort, never throws.
  const authorLabel = post.isAnonymous ? "an anonymous member" : post.authorNameSnapshot;
  const snippet = post.body.replace(/\s+/g, " ").slice(0, 80).trim();
  await createForAllAdmins({
    type: "POST_REPORTED",
    title: input.commentId
      ? `Comment reported (${humanReason(input.reason)})`
      : `Post reported (${humanReason(input.reason)})`,
    message: input.commentId
      ? `A comment by ${commentAuthorName ?? "unknown"} on ${authorLabel}'s post was flagged.`
      : `${authorLabel}'s post was flagged: "${snippet}${post.body.length > 80 ? "…" : ""}"`,
    actionUrl: "/admin/posts/reports",
  });

  return { ok: true, id: report.id, duplicate: false };
}

function humanReason(reason: ReportReason): string {
  const map: Record<ReportReason, string> = {
    SPAM: "spam",
    HARASSMENT: "harassment",
    HATE_SPEECH: "hate speech",
    SELF_HARM: "self-harm",
    ADULT_CONTENT: "adult content",
    MISINFORMATION: "misinformation",
    OFF_TOPIC: "off-topic",
    OTHER: "other",
  };
  return map[reason];
}

/** Set of enum values a client is allowed to send. Kept next to the
 *  helper so the API route + any admin form share one source of truth. */
export const VALID_REPORT_REASONS: readonly ReportReason[] = [
  "SPAM",
  "HARASSMENT",
  "HATE_SPEECH",
  "SELF_HARM",
  "ADULT_CONTENT",
  "MISINFORMATION",
  "OFF_TOPIC",
  "OTHER",
] as const;

/** Runtime type guard used by API routes to validate `body.reason`. */
export function isValidReason(x: unknown): x is ReportReason {
  return typeof x === "string" && (VALID_REPORT_REASONS as readonly string[]).includes(x);
}

// The `Prisma` type import guards against future Prisma bumps
// silently changing the transactional signature.
export type _ReportTxHint = Prisma.PostReportCreateInput;
