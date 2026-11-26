/**
 * Backfill `openKey` / `openMessageId` on reports that are still open,
 * and close the duplicates that got filed before the unique index
 * existed.
 *
 *   npm run reports:check
 *   npm run reports:fix
 *
 * RUN THIS AFTER `prisma db push`, not before. The push adds the two
 * columns as nullable and the unique indexes alongside them; because
 * every existing row has NULL there, and MySQL treats NULLs in a
 * unique index as distinct, the index builds cleanly over the old data
 * however many duplicates are in it. This script then fills the keys
 * in — and it is the moment those duplicates have to be dealt with,
 * because two open reports from the same person on the same thing
 * cannot both hold the key.
 *
 * DUPLICATES ARE NOT DELETED. The oldest of each group keeps the key
 * and stays open; the rest are marked DISMISSED with a note saying
 * why, so the moderation history stays honest and nothing a member
 * submitted silently disappears. `reportCount` is then recomputed from
 * what is actually there.
 *
 * Dry run by default.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

const NOTE = "Closed automatically: duplicate of an earlier open report from the same member.";

async function postReports(): Promise<void> {
  const open = await prisma.postReport.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, reporterId: true, postId: true, commentId: true, openKey: true },
  });

  const seen = new Set<string>();
  const keep: Array<{ id: string; openKey: string }> = [];
  const close: string[] = [];

  for (const r of open) {
    const openKey = r.commentId ? `COMMENT:${r.commentId}` : `POST:${r.postId}`;
    // A null reporter (their account is gone) can never collide, so
    // those rows are left alone rather than being closed as dupes of
    // each other.
    const groupKey = r.reporterId ? `${r.reporterId}|${openKey}` : null;
    if (groupKey && seen.has(groupKey)) {
      close.push(r.id);
      continue;
    }
    if (groupKey) seen.add(groupKey);
    if (r.openKey !== openKey) keep.push({ id: r.id, openKey });
  }

  console.log(`post reports:  ${open.length} open, ${keep.length} to key, ${close.length} duplicate(s) to close`);

  if (!apply) return;

  for (const k of keep) {
    await prisma.postReport.update({ where: { id: k.id }, data: { openKey: k.openKey } });
  }
  if (close.length) {
    await prisma.postReport.updateMany({
      where: { id: { in: close } },
      data: { status: "DISMISSED", resolvedAt: new Date(), resolution: NOTE, openKey: null },
    });
  }
}

async function chatReports(): Promise<void> {
  const open = await prisma.chatMessageReport.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, reporterId: true, messageId: true, openMessageId: true },
  });

  const seen = new Set<string>();
  const keep: string[] = [];
  const close: string[] = [];

  for (const r of open) {
    const groupKey = r.reporterId ? `${r.reporterId}|${r.messageId}` : null;
    if (groupKey && seen.has(groupKey)) {
      close.push(r.id);
      continue;
    }
    if (groupKey) seen.add(groupKey);
    if (r.openMessageId !== r.messageId) keep.push(r.id);
  }

  console.log(`chat reports:  ${open.length} open, ${keep.length} to key, ${close.length} duplicate(s) to close`);

  if (!apply) return;

  for (const id of keep) {
    const row = open.find((o) => o.id === id);
    if (row) {
      await prisma.chatMessageReport.update({
        where: { id },
        data: { openMessageId: row.messageId },
      });
    }
  }
  if (close.length) {
    await prisma.chatMessageReport.updateMany({
      where: { id: { in: close } },
      data: { status: "DISMISSED", resolvedAt: new Date(), openMessageId: null },
    });
  }
}

/**
 * reportCount on the target, recomputed from the reports that are
 * actually open. Closing a duplicate above means the old count is now
 * one too high, and these counters were never recounted anywhere.
 */
async function recountReportCounts(): Promise<void> {
  const [posts, comments, messages] = await Promise.all([
    prisma.postReport.groupBy({
      by: ["postId"],
      where: { status: "OPEN", targetType: "POST" },
      _count: { _all: true },
    }),
    prisma.postReport.groupBy({
      by: ["commentId"],
      where: { status: "OPEN", targetType: "COMMENT", commentId: { not: null } },
      _count: { _all: true },
    }),
    prisma.chatMessageReport.groupBy({
      by: ["messageId"],
      where: { status: "OPEN" },
      _count: { _all: true },
    }),
  ]);

  const postCounts = new Map(posts.map((p) => [p.postId, p._count._all]));
  const commentCounts = new Map(
    comments.flatMap((c) => (c.commentId ? [[c.commentId, c._count._all] as const] : [])),
  );
  const messageCounts = new Map(messages.map((m) => [m.messageId, m._count._all]));

  let off = 0;

  const postRows = await prisma.post.findMany({ select: { id: true, reportCount: true } });
  for (const row of postRows) {
    const to = postCounts.get(row.id) ?? 0;
    if (to === row.reportCount) continue;
    off++;
    if (apply) await prisma.post.update({ where: { id: row.id }, data: { reportCount: to } });
  }

  const commentRows = await prisma.postComment.findMany({ select: { id: true, reportCount: true } });
  for (const row of commentRows) {
    const to = commentCounts.get(row.id) ?? 0;
    if (to === row.reportCount) continue;
    off++;
    if (apply) await prisma.postComment.update({ where: { id: row.id }, data: { reportCount: to } });
  }

  const messageRows = await prisma.chatMessage.findMany({ select: { id: true, reportCount: true } });
  for (const row of messageRows) {
    const to = messageCounts.get(row.id) ?? 0;
    if (to === row.reportCount) continue;
    off++;
    if (apply) await prisma.chatMessage.update({ where: { id: row.id }, data: { reportCount: to } });
  }

  console.log(`reportCount:   ${off} row(s) ${apply ? "corrected" : "off"}`);
}

async function main(): Promise<void> {
  console.log(apply ? "Applying." : "Dry run — nothing will be written.\n");
  await postReports();
  await chatReports();
  await recountReportCounts();
  if (!apply) console.log("\nRe-run with --apply to write these.");
}

main()
  .catch((err) => {
    console.error("\nFailed:", err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
