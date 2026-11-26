/**
 * The private journal. "A private space to write what they can't say
 * out loud yet. Only the user sees it." — plan.docx §4.
 *
 * IT IS THE SAME TABLE AS THE DAILY REFLECTION, on purpose. Answering
 * the day's question and writing a paragraph about your day are the
 * same act — a member putting something down that nobody else will
 * read — and two tables would have meant two privacy rules to keep in
 * step and one day where somebody filters the wrong one.
 *
 * PRIVACY HERE IS STRUCTURAL. There is no `isPrivate` column to forget
 * in a `where`. Every function below takes a `userId` and scopes to it;
 * nothing in this file, and nothing anywhere else, reads an entry
 * without one. The single way a word of this reaches another person is
 * `shareEntry`, which the member calls deliberately, one entry at a
 * time, and which copies the text into a Post rather than exposing the
 * entry itself.
 *
 * SHARING IS A COPY, NOT A FLAG. If it flipped a visibility bit, then
 * editing the entry afterwards would silently rewrite something
 * already public, and deleting it would tear a hole in somebody's
 * feed. A post is its own thing from the moment it exists.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { createPost } from "./posts-write";

const BODY_MAX = 20_000;

export interface JournalEntry {
  id: string;
  body: string;
  /** The question this answered, when it answered one. */
  question: { id: string; body: string } | null;
  /** Non-null once the member has shared it. */
  sharedPostId: string | null;
  sharedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class JournalRefused extends Error {}

const SELECT = {
  id: true,
  body: true,
  sharedPostId: true,
  sharedAt: true,
  createdAt: true,
  updatedAt: true,
  question: { select: { id: true, body: true } },
} satisfies Prisma.DailyReflectionSelect;

function shape(row: Prisma.DailyReflectionGetPayload<{ select: typeof SELECT }>): JournalEntry {
  return {
    id: row.id,
    body: row.body,
    question: row.question ?? null,
    sharedPostId: row.sharedPostId,
    sharedAt: row.sharedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface JournalPage {
  entries: JournalEntry[];
  nextCursor: string | null;
  total: number;
}

/**
 * A member's own entries, newest first.
 *
 * Cursor is the entry id — simpler than a composite date cursor and
 * sufficient here, because `createdAt` is unique enough in a personal
 * journal and the index is `[userId, createdAt]`.
 */
export async function listJournal(
  userId: string,
  opts: { cursor?: string | null; limit?: number } = {},
): Promise<JournalPage> {
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
  const [rows, total] = await Promise.all([
    prisma.dailyReflection.findMany({
      where: { userId },
      select: SELECT,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    }),
    prisma.dailyReflection.count({ where: { userId } }),
  ]);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    entries: page.map(shape),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    total,
  };
}

/** One entry — scoped to its owner, so a guessed id returns nothing. */
export async function getEntry(userId: string, entryId: string): Promise<JournalEntry | null> {
  const row = await prisma.dailyReflection.findFirst({
    where: { id: entryId, userId },
    select: SELECT,
  });
  return row ? shape(row) : null;
}

/** Free-form. No question, no prompt, no minimum beyond "something". */
export async function writeEntry(userId: string, body: string): Promise<JournalEntry> {
  const clean = body.trim();
  if (!clean) throw new JournalRefused("Write something first.");
  if (clean.length > BODY_MAX) throw new JournalRefused("That's longer than the journal allows.");

  const row = await prisma.dailyReflection.create({
    data: { userId, body: clean, questionId: null },
    select: SELECT,
  });
  return shape(row);
}

/**
 * Edit an entry.
 *
 * Allowed even after sharing — the shared copy is a separate Post and
 * is not touched, which is exactly why sharing copies rather than
 * flags. The member is editing their own diary, not rewriting
 * something other people have already read.
 */
export async function editEntry(
  userId: string,
  entryId: string,
  body: string,
): Promise<JournalEntry> {
  const clean = body.trim();
  if (!clean) throw new JournalRefused("Write something first.");
  if (clean.length > BODY_MAX) throw new JournalRefused("That's longer than the journal allows.");

  const owned = await prisma.dailyReflection.findFirst({
    where: { id: entryId, userId },
    select: { id: true },
  });
  if (!owned) throw new JournalRefused("That entry is gone.");

  const row = await prisma.dailyReflection.update({
    where: { id: entryId },
    data: { body: clean },
    select: SELECT,
  });
  return shape(row);
}

/** Delete. The member's own words, entirely their own to remove. */
export async function deleteEntry(userId: string, entryId: string): Promise<void> {
  await prisma.dailyReflection.deleteMany({ where: { id: entryId, userId } });
}

/**
 * "If they later feel ready to share a specific entry publicly, one tap
 * does it." — plan.docx §4.
 *
 * Refuses to share the same entry twice: a second tap would create a
 * duplicate post and there would be no way to tell which one the
 * journal was pointing at.
 */
export async function shareEntry(
  userId: string,
  entryId: string,
  opts: { isAnonymous?: boolean } = {},
): Promise<{ postId: string }> {
  const entry = await prisma.dailyReflection.findFirst({
    where: { id: entryId, userId },
    select: { id: true, body: true, sharedPostId: true },
  });
  if (!entry) throw new JournalRefused("That entry is gone.");
  if (entry.sharedPostId) throw new JournalRefused("You've already shared this one.");

  const post = await createPost({
    authorId: userId,
    body: entry.body,
    isAnonymous: !!opts.isAnonymous,
  });

  await prisma.dailyReflection.update({
    where: { id: entryId },
    data: { sharedPostId: post.id, sharedAt: new Date() },
  });

  return { postId: post.id };
}

/**
 * How many days in a row the member has written something.
 *
 * The one streak in this project that is NOT a declared date, because
 * here the act itself is recorded — an entry exists or it does not, and
 * counting backwards from today over distinct dates is the honest
 * answer. Stops at the first gap.
 */
export async function journalingStreak(userId: string): Promise<number> {
  const rows = await prisma.dailyReflection.findMany({
    where: { userId },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 400,
  });
  if (!rows.length) return 0;

  const days = new Set(rows.map((r) => r.createdAt.toISOString().slice(0, 10)));
  const now = new Date();
  let cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Yesterday is allowed to be the most recent day: somebody who has
  // not written YET today has not broken anything.
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor = new Date(cursor.getTime() - 86_400_000);
    if (!days.has(cursor.toISOString().slice(0, 10))) return 0;
  }

  let n = 0;
  for (;;) {
    if (!days.has(cursor.toISOString().slice(0, 10))) break;
    n += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return n;
}
