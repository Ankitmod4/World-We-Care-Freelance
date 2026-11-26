/**
 * Comments on library clips.
 *
 * Deliberately the same shape as article comments — list flat, group in
 * the client, one level of replies, likes, author snapshots. Where the
 * two differ it is a bug in one of them, not a design choice.
 *
 * THREE RULES THAT ARE NOT OBVIOUS FROM THE TYPES:
 *
 *  1. THREADS ARE ONE LEVEL. A reply to a reply is re-parented to the
 *     top-level comment. Without that cap the UI indents until the
 *     text is a column one word wide, and the query needs recursion to
 *     read back.
 *  2. A PARENT MUST BELONG TO THE SAME CLIP. The parent id comes from
 *     a form; without the check, a reply can be filed under a comment
 *     on a different clip and appear in a thread nobody can explain.
 *  3. COUNTS ARE RECOUNTED, NEVER INCREMENTED. A counter that drifts
 *     is worse than one that costs a COUNT — this codebase already
 *     recounts everywhere else and this is not the place to differ.
 */

import { prisma } from "./db";
import { getBlockedIds } from "./blocks";
import { commentReactionResult, reactionOutcome } from "./reaction-toggle";
import type { ReactionType } from "./reactions";

const BODY_MAX = 4000;

export interface ClipCommentItem {
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

/**
 * Every published comment on a clip, oldest first, flat.
 *
 * Flat on purpose: the client groups them. A thread two levels deep
 * fits in one query and one pass, and the alternative — nested
 * includes — costs a query per level to produce the same thing.
 */
export async function listClipComments(
  clipId: string,
  viewerId?: string | null,
): Promise<ClipCommentItem[]> {
  /* Blocked authors drop out here, the same way they do for post
     comments (see the `blockedIds` option in @/lib/comments). Without
     it, blocking somebody silenced them on the wall but they carried
     on appearing under every article and clip — which reads as the
     block having quietly stopped working. */
  const blockedIds = viewerId ? await getBlockedIds(viewerId) : [];

  const rows = await prisma.clipComment.findMany({
    where: {
      clipId,
      status: "PUBLISHED",
      ...(blockedIds.length ? { authorId: { notIn: blockedIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      parentId: true,
      authorId: true,
      authorNameSnapshot: true,
      authorAvatarSnapshot: true,
      body: true,
      isAnonymous: true,
      likeCount: true,
      createdAt: true,
    },
  });
  if (rows.length === 0) return [];

  // One query for the viewer's likes across the whole thread, rather
  // than one per comment.
  const liked = new Map<string, ReactionType>(
    viewerId
      ? (
          await prisma.clipCommentLike.findMany({
            where: { userId: viewerId, commentId: { in: rows.map((r) => r.id) } },
            select: { commentId: true, type: true },
          })
        ).map((l) => [l.commentId, l.type as ReactionType])
      : [],
  );

  // Live author details where the comment is not anonymous, so a
  // changed display name or avatar shows through the snapshot.
  const authorIds = [...new Set(rows.filter((r) => !r.isAnonymous).map((r) => r.authorId))];
  // Built by hand rather than from `users.map(u => [u.id, u])`: the
  // ternary above gives `users` a union type, and the tuple inference
  // the Map constructor needs collapses to `{}` across a union.
  const byId = new Map<string, { displayName: string; avatarUrl: string | null }>();
  if (authorIds.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, displayName: true, avatarUrl: true },
    });
    for (const u of users) byId.set(u.id, u);
  }

  return rows.map((r) => {
    const live = r.isAnonymous ? undefined : byId.get(r.authorId);
    return {
      id: r.id,
      parentId: r.parentId,
      // An anonymous comment gives up its author id as well as its
      // name — a link to the profile would undo the anonymity the
      // person asked for.
      authorId: r.isAnonymous ? null : r.authorId,
      authorName: r.isAnonymous ? "Anonymous" : live?.displayName ?? r.authorNameSnapshot,
      authorAvatar: r.isAnonymous ? null : live?.avatarUrl ?? r.authorAvatarSnapshot,
      body: r.body,
      isAnonymous: r.isAnonymous,
      likeCount: r.likeCount,
      liked: liked.has(r.id),
      myReaction: liked.get(r.id) ?? null,
      // Own-ness is computed from the real author id, not the masked
      // one, so a person can still delete their own anonymous comment.
      isOwn: !!viewerId && r.authorId === viewerId,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export async function addClipComment(input: {
  clipId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  body: string;
  isAnonymous?: boolean;
  parentId?: string | null;
}): Promise<{ comment: ClipCommentItem; commentCount: number }> {
  const body = input.body.trim();
  if (!body) throw new Error("Write something first.");
  if (body.length > BODY_MAX) throw new Error(`Keep it under ${BODY_MAX} characters.`);

  const clip = await prisma.clip.findFirst({
    where: { id: input.clipId, isPublished: true },
    select: { id: true },
  });
  if (!clip) throw new Error("Clip not found");

  // Rules 1 and 2, together.
  let parentId: string | null = null;
  if (input.parentId) {
    const parent = await prisma.clipComment.findFirst({
      where: { id: input.parentId, clipId: input.clipId, status: "PUBLISHED" },
      select: { id: true, parentId: true },
    });
    if (!parent) throw new Error("That comment is no longer there.");
    parentId = parent.parentId ?? parent.id;
  }

  const row = await prisma.clipComment.create({
    data: {
      clipId: input.clipId,
      authorId: input.userId,
      authorNameSnapshot: input.displayName,
      authorAvatarSnapshot: input.avatarUrl ?? null,
      body: body.slice(0, BODY_MAX),
      isAnonymous: input.isAnonymous ?? false,
      parentId,
    },
  });

  const commentCount = await recount(input.clipId);

  return {
    comment: {
      id: row.id,
      parentId: row.parentId,
      authorId: row.isAnonymous ? null : row.authorId,
      authorName: row.isAnonymous ? "Anonymous" : input.displayName,
      authorAvatar: row.isAnonymous ? null : input.avatarUrl ?? null,
      body: row.body,
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

/** Leave, change or take back a reaction on a comment. */
export async function toggleClipCommentLike(
  commentId: string,
  userId: string,
  rawType?: unknown,
): Promise<{ liked: boolean; likeCount: number; myReaction: ReactionType | null }> {
  const comment = await prisma.clipComment.findFirst({
    where: { id: commentId, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!comment) throw new Error("Comment not found");

  const key = { commentId_userId: { commentId, userId } };
  const existing = await prisma.clipCommentLike.findUnique({ where: key, select: { type: true } });
  const outcome = reactionOutcome((existing?.type as ReactionType) ?? null, rawType);

  if (outcome.kind === "removed") await prisma.clipCommentLike.delete({ where: key });
  else if (outcome.kind === "changed")
    await prisma.clipCommentLike.update({ where: key, data: { type: outcome.type } });
  else await prisma.clipCommentLike.create({ data: { commentId, userId, type: outcome.type } });

  // Recounted, never incremented.
  const likeCount = await prisma.clipCommentLike.count({ where: { commentId } });
  await prisma.clipComment.update({ where: { id: commentId }, data: { likeCount } });

  return commentReactionResult(outcome, likeCount);
}

/**
 * Delete your own comment.
 *
 * A hard delete, and the database cascade takes the replies with it.
 * That is the honest behaviour: leaving "[deleted]" stubs with live
 * replies underneath means the thread still shows a conversation the
 * person asked to withdraw from.
 */
export async function deleteOwnClipComment(
  commentId: string,
  userId: string,
): Promise<{ commentCount: number }> {
  const comment = await prisma.clipComment.findUnique({
    where: { id: commentId },
    select: { id: true, clipId: true, authorId: true },
  });
  if (!comment) throw new Error("Comment not found");
  if (comment.authorId !== userId) throw new Error("Not your comment");

  await prisma.clipComment.delete({ where: { id: commentId } });
  return { commentCount: await recount(comment.clipId) };
}

/** Admin removal — kept, not deleted, so the moderation is auditable. */
export async function setClipCommentStatus(
  commentId: string,
  status: "PUBLISHED" | "REMOVED",
  removedReason?: string | null,
): Promise<{ commentCount: number }> {
  const comment = await prisma.clipComment.update({
    where: { id: commentId },
    data: {
      status,
      removedReason: status === "REMOVED" ? removedReason?.slice(0, 2000) ?? null : null,
    },
    select: { clipId: true },
  });
  return { commentCount: await recount(comment.clipId) };
}

/** Rule 3. */
async function recount(clipId: string): Promise<number> {
  const commentCount = await prisma.clipComment.count({
    where: { clipId, status: "PUBLISHED" },
  });
  await prisma.clip.update({ where: { id: clipId }, data: { commentCount } });
  return commentCount;
}
