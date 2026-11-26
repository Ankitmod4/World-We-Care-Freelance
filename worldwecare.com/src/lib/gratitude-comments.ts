/**
 * Comments on gratitude entries.
 *
 * Deliberately the same shape as clip comments — list flat, group in
 * the client, one level of replies, author snapshots. Where the two
 * differ it is a bug in one of them, not a design choice. They share
 * the same UI component (`ThreadedComments`) for exactly that reason.
 *
 * THE RULES, ALL OF WHICH ARE LOAD-BEARING:
 *
 *  1. THREADS ARE ONE LEVEL. A reply to a reply is re-parented to the
 *     top-level comment. Without the cap the UI indents until the text
 *     is a column one word wide, and reading the thread back needs
 *     recursion.
 *  2. A PARENT MUST BELONG TO THE SAME ENTRY. The parent id comes from
 *     a form; without the check a reply can be filed under a comment
 *     on a different entry and appear in a thread nobody can explain.
 *  3. COUNTS ARE RECOUNTED, NEVER INCREMENTED.
 *  4. ONLY APPROVED ENTRIES TAKE COMMENTS. The wall is moderated;
 *     a comment on something still awaiting review would be visible
 *     before the thing it is about.
 *
 * REACTIONS ON REPLIES, as well as on the entry. That reverses an
 * earlier call here — the reasoning then was that two affordances on
 * one card is two vocabularies, and it lost to the simpler argument
 * that a reply deserves the same response as anything else somebody
 * writes on this site. Same control, same six reactions, everywhere.
 */

import { prisma } from "./db";
import { getBlockedIds } from "./blocks";
import { getMasker } from "./banned-words";
import { createUserNotification } from "./notifications";
import { commentReactionResult, reactionOutcome } from "./reaction-toggle";
import type { ReactionType } from "./reactions";

const BODY_MAX = 4000;

export interface GratitudeCommentItem {
  id: string;
  parentId: string | null;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  body: string;
  isAnonymous: boolean;
  likeCount: number;
  liked: boolean;
  myReaction: ReactionType | null;
  isOwn: boolean;
  createdAt: string;
}

/** Every comment on an entry, oldest first, flat — the client threads them. */
export async function listGratitudeComments(
  entryId: string,
  viewerId?: string | null,
): Promise<GratitudeCommentItem[]> {
  // Blocking somebody has to silence them everywhere, or it reads as
  // having quietly stopped working.
  const blockedIds = viewerId ? await getBlockedIds(viewerId) : [];

  const rows = await prisma.gratitudeComment.findMany({
    where: {
      entryId,
      ...(blockedIds.length ? { authorId: { notIn: blockedIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  const authorIds = [...new Set(rows.filter((r) => !r.isAnonymous).map((r) => r.authorId))];
  const byId = new Map<string, { displayName: string; avatarUrl: string | null }>();
  if (authorIds.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, displayName: true, avatarUrl: true },
    });
    for (const u of users) byId.set(u.id, u);
  }

  // One query for the viewer's reactions across the whole thread,
  // rather than one per comment.
  const mine = new Map<string, ReactionType>(
    viewerId && rows.length
      ? (
          await prisma.gratitudeCommentReaction.findMany({
            where: { userId: viewerId, commentId: { in: rows.map((r) => r.id) } },
            select: { commentId: true, type: true },
          })
        ).map((x) => [x.commentId, x.type as ReactionType])
      : [],
  );

  const mask = await getMasker();

  return rows.map((r) => {
    const live = r.isAnonymous ? undefined : byId.get(r.authorId);
    return {
      id: r.id,
      parentId: r.parentId,
      // An anonymous comment gives up its author id as well as its
      // name — a link to the profile would undo the anonymity.
      authorId: r.isAnonymous ? null : r.authorId,
      authorName: r.isAnonymous ? "Anonymous" : live?.displayName ?? r.authorNameSnapshot,
      authorAvatar: r.isAnonymous ? null : live?.avatarUrl ?? r.authorAvatarSnapshot,
      body: mask(r.body),
      isAnonymous: r.isAnonymous,
      likeCount: r.likeCount,
      liked: mine.has(r.id),
      myReaction: mine.get(r.id) ?? null,
      // Computed from the REAL author id, so somebody can still delete
      // their own anonymous comment.
      isOwn: !!viewerId && r.authorId === viewerId,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export async function addGratitudeComment(input: {
  entryId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  body: string;
  isAnonymous?: boolean;
  parentId?: string | null;
}): Promise<{ comment: GratitudeCommentItem; commentCount: number }> {
  const body = input.body.trim();
  if (!body) throw new Error("Write something first.");
  if (body.length > BODY_MAX) throw new Error(`Keep it under ${BODY_MAX} characters.`);

  // Rule 4.
  const entry = await prisma.gratitudeEntry.findFirst({
    where: { id: input.entryId, status: "APPROVED" },
    select: { id: true, authorId: true, isAnonymous: true },
  });
  if (!entry) throw new Error("This entry isn't available.");

  // Rules 1 and 2, together.
  let parentId: string | null = null;
  if (input.parentId) {
    const parent = await prisma.gratitudeComment.findFirst({
      where: { id: input.parentId, entryId: input.entryId },
      select: { id: true, parentId: true },
    });
    if (!parent) throw new Error("That comment is no longer there.");
    parentId = parent.parentId ?? parent.id;
  }

  const row = await prisma.gratitudeComment.create({
    data: {
      entryId: input.entryId,
      authorId: input.userId,
      authorNameSnapshot: input.displayName,
      authorAvatarSnapshot: input.avatarUrl ?? null,
      body: body.slice(0, BODY_MAX),
      isAnonymous: input.isAnonymous ?? false,
      parentId,
    },
  });

  const commentCount = await recount(input.entryId);

  // Tell the author, unless it is their own entry. The notification
  // names the commenter only when the commenter chose to be named —
  // an anonymous reply that arrives signed is not anonymous.
  if (entry.authorId !== input.userId) {
    await createUserNotification({
      userId: entry.authorId,
      type: "SYSTEM",
      title: `${row.isAnonymous ? "Someone" : input.displayName} replied to your gratitude post`,
      body: body.slice(0, 120),
      actionUrl: "/gratitude",
    });
  }

  const mask = await getMasker();
  return {
    comment: {
      id: row.id,
      parentId: row.parentId,
      authorId: row.isAnonymous ? null : row.authorId,
      authorName: row.isAnonymous ? "Anonymous" : input.displayName,
      authorAvatar: row.isAnonymous ? null : input.avatarUrl ?? null,
      body: mask(row.body),
      isAnonymous: row.isAnonymous,
      likeCount: 0,
      liked: false,
      myReaction: null,
      isOwn: true,
      createdAt: row.createdAt.toISOString(),
    },
    commentCount,
  };
}

/**
 * Delete your own comment.
 *
 * A hard delete, and the database cascade takes the replies with it.
 * Leaving a "[deleted]" stub with live replies underneath would mean
 * the thread still shows a conversation the person withdrew from.
 */
export async function deleteOwnGratitudeComment(
  commentId: string,
  userId: string,
): Promise<{ commentCount: number }> {
  const comment = await prisma.gratitudeComment.findUnique({
    where: { id: commentId },
    select: { id: true, entryId: true, authorId: true },
  });
  if (!comment) throw new Error("Comment not found");
  if (comment.authorId !== userId) throw new Error("Not your comment");

  await prisma.gratitudeComment.delete({ where: { id: commentId } });
  return { commentCount: await recount(comment.entryId) };
}

/** Rule 3. */
async function recount(entryId: string): Promise<number> {
  const commentCount = await prisma.gratitudeComment.count({ where: { entryId } });
  await prisma.gratitudeEntry.update({ where: { id: entryId }, data: { commentCount } });
  return commentCount;
}

/** Leave, change or take back a reaction on a comment. */
export async function toggleGratitudeCommentReaction(
  commentId: string,
  userId: string,
  rawType?: unknown,
): Promise<{ liked: boolean; likeCount: number; myReaction: ReactionType | null }> {
  const key = { commentId_userId: { commentId, userId } };
  const existing = await prisma.gratitudeCommentReaction.findUnique({ where: key, select: { type: true } });
  const outcome = reactionOutcome((existing?.type as ReactionType) ?? null, rawType);

  if (outcome.kind === "removed") await prisma.gratitudeCommentReaction.delete({ where: key });
  else if (outcome.kind === "changed")
    await prisma.gratitudeCommentReaction.update({ where: key, data: { type: outcome.type } });
  else await prisma.gratitudeCommentReaction.create({ data: { commentId, userId, type: outcome.type } });

  // Recounted, never incremented.
  const likeCount = await prisma.gratitudeCommentReaction.count({ where: { commentId } });
  await prisma.gratitudeComment.update({ where: { id: commentId }, data: { likeCount } });

  return commentReactionResult(outcome, likeCount);
}
