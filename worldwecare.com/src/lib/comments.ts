/**
 * User-side comments — read + write.
 *
 * Mirrors the post feed patterns: cursor pagination on
 * (createdAt, id), author name/avatar frozen into a snapshot so a
 * deleted user doesn't blank the thread, and the post's
 * `commentCount` denorm kept in sync inside the same transaction as
 * the insert.
 *
 * Moderation reuses the existing PostComment.status pipeline — the
 * user surface only ever reads PUBLISHED rows.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getMasker } from "./banned-words";
import { createUserNotification } from "./notifications";
import { commentReactionResult, reactionOutcome } from "./reaction-toggle";
import type { ReactionType } from "./reactions";

export const COMMENT_BODY_MAX = 2000;

export interface FeedComment {
  id: string;
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

export interface CommentPage {
  items: FeedComment[];
  nextCursor: string | null;
}

function encodeCursor(row: { createdAt: Date; id: string }): string {
  return `${row.createdAt.toISOString()}_${row.id}`;
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  const idx = cursor.lastIndexOf("_");
  if (idx <= 0) return null;
  const iso = cursor.slice(0, idx);
  const id = cursor.slice(idx + 1);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || !id) return null;
  return { createdAt: d, id };
}

export interface ListCommentsOptions {
  postId: string;
  viewerId: string | null;
  cursor?: string | null;
  limit?: number;
  blockedIds?: string[];
}

/**
 * Newest-first thread. We deliberately order desc + reverse on the
 * client is NOT done — the composer sits at the top of the thread on
 * the card, so newest-first keeps a just-posted comment visible
 * without scrolling.
 */
export async function listComments(opts: ListCommentsOptions): Promise<CommentPage> {
  const limit = Math.min(50, Math.max(5, opts.limit ?? 20));

  const where: Prisma.PostCommentWhereInput = {
    postId: opts.postId,
    status: "PUBLISHED",
    ...(opts.blockedIds && opts.blockedIds.length ? { authorId: { notIn: opts.blockedIds } } : {}),
  };

  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
  if (cursor) {
    where.OR = [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ];
  }

  const rows = await prisma.postComment.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;

  // One query for the viewer's reactions across the page of comments.
  const mine = new Map<string, ReactionType>(
    opts.viewerId && slice.length
      ? (
          await prisma.postCommentReaction.findMany({
            where: { userId: opts.viewerId, commentId: { in: slice.map((c) => c.id) } },
            select: { commentId: true, type: true },
          })
        ).map((x) => [x.commentId, x.type as ReactionType])
      : [],
  );

  const mask = await getMasker();
  return {
    items: slice.map<FeedComment>((c) => ({
      id: c.id,
      authorId: c.authorId,
      authorName: c.authorNameSnapshot,
      authorAvatar: c.authorAvatarSnapshot,
      body: mask(c.body),
      isAnonymous: c.isAnonymous,
      likeCount: c.likeCount,
      liked: mine.has(c.id),
      myReaction: mine.get(c.id) ?? null,
      isOwn: opts.viewerId !== null && c.authorId === opts.viewerId,
      createdAt: c.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? encodeCursor(slice[slice.length - 1]!) : null,
  };
}

export interface CreateCommentInput {
  postId: string;
  authorId: string;
  body: string;
  isAnonymous?: boolean;
}

export async function createComment(input: CreateCommentInput): Promise<FeedComment> {
  const body = input.body.trim();
  if (body.length < 1) throw new Error("Comment can't be empty.");
  if (body.length > COMMENT_BODY_MAX) {
    throw new Error(`Comment is too long (${body.length}/${COMMENT_BODY_MAX}).`);
  }

  const author = await prisma.user.findUnique({
    where: { id: input.authorId },
    select: { displayName: true, avatarUrl: true, isActive: true, bannedAt: true },
  });
  if (!author) throw new Error("User not found");
  if (!author.isActive) throw new Error("Account is deactivated.");
  if (author.bannedAt) throw new Error("Account is banned.");

  const post = await prisma.post.findUnique({
    where: { id: input.postId },
    select: { status: true, authorId: true },
  });
  if (!post) throw new Error("Post not found");
  if (post.status !== "PUBLISHED") throw new Error("Post not available");

  // Insert + bump the denorm counter atomically so the card's
  // comment count never drifts from the row count.
  const [comment] = await prisma.$transaction([
    prisma.postComment.create({
      data: {
        postId: input.postId,
        authorId: input.authorId,
        authorNameSnapshot: author.displayName,
        authorAvatarSnapshot: author.avatarUrl ?? null,
        body,
        isAnonymous: input.isAnonymous ?? false,
      },
    }),
    prisma.post.update({
      where: { id: input.postId },
      data: { commentCount: { increment: 1 } },
    }),
  ]);

  if (post.authorId && post.authorId !== input.authorId) {
    await createUserNotification({
      userId: post.authorId,
      type: "POST_COMMENT",
      title: `${input.isAnonymous ? "Someone" : author.displayName} commented on your post`,
      body: body.slice(0, 120),
      actionUrl: `/post/${input.postId}`,
    });
  }

  return {
    id: comment.id,
    authorId: comment.authorId,
    authorName: comment.authorNameSnapshot,
    authorAvatar: comment.authorAvatarSnapshot,
    body: comment.body,
    isAnonymous: comment.isAnonymous,
    likeCount: 0,
    liked: false,
    myReaction: null,
    isOwn: true,
    createdAt: comment.createdAt.toISOString(),
  };
}

/**
 * Author-initiated comment delete. Verifies ownership, removes the
 * row, and decrements the post's commentCount denorm (only when the
 * comment was still PUBLISHED, so a moderator-removed comment the
 * author then deletes can't push the counter negative).
 */
export async function deleteComment(userId: string, commentId: string): Promise<void> {
  const c = await prisma.postComment.findUnique({
    where: { id: commentId },
    select: { authorId: true, postId: true, status: true },
  });
  if (!c) throw new Error("Comment not found");
  if (c.authorId !== userId) throw new Error("Not your comment");

  if (c.status === "PUBLISHED") {
    await prisma.$transaction([
      prisma.postComment.delete({ where: { id: commentId } }),
      prisma.post.update({
        where: { id: c.postId },
        data: { commentCount: { decrement: 1 } },
      }),
    ]);
  } else {
    await prisma.postComment.delete({ where: { id: commentId } });
  }
}

/**
 * Leave, change or take back a reaction on a post comment.
 *
 * `PostComment.likeCount` has been in the schema since long before
 * anything wrote it. This is what finally fills it in.
 */
export async function togglePostCommentReaction(
  commentId: string,
  userId: string,
  rawType?: unknown,
): Promise<{ liked: boolean; likeCount: number; myReaction: ReactionType | null }> {
  const comment = await prisma.postComment.findFirst({
    where: { id: commentId, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!comment) throw new Error("Comment not found");

  const key = { commentId_userId: { commentId, userId } };
  const existing = await prisma.postCommentReaction.findUnique({ where: key, select: { type: true } });
  const outcome = reactionOutcome((existing?.type as ReactionType) ?? null, rawType);

  if (outcome.kind === "removed") await prisma.postCommentReaction.delete({ where: key });
  else if (outcome.kind === "changed")
    await prisma.postCommentReaction.update({ where: key, data: { type: outcome.type } });
  else await prisma.postCommentReaction.create({ data: { commentId, userId, type: outcome.type } });

  // Recounted, never incremented.
  const likeCount = await prisma.postCommentReaction.count({ where: { commentId } });
  await prisma.postComment.update({ where: { id: commentId }, data: { likeCount } });

  return commentReactionResult(outcome, likeCount);
}
