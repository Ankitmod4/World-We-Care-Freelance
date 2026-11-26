/**
 * Community wall admin helpers.
 *
 * The admin view is moderator-focused: browse everything (published,
 * pending, removed), open a report queue, remove/restore posts and
 * comments, feature or un-feature.
 *
 * Denorm counters (likeCount / commentCount / reportCount) are the
 * source of truth for the feed page. They're updated as part of the
 * mutations here so admins never see stale numbers after acting.
 *
 * Every mutation records an AdminActionLog entry with a small meta
 * blob so we can answer "who removed this post and why" later.
 */

import type { Prisma } from "@prisma/client";
import { parseVideo, type PostVideo } from "./posts-feed";
import { deleteMediaByUrls, extractLocalImageUrls } from "./media";
import { postImageUrls } from "./posts-write";
import { discardVideo } from "./video-status";
import {
  AdminAction,
  PostStatus,
  ReportStatus,
  ReportTargetType,
} from "@prisma/client";
import { prisma } from "./db";
import { logAdminAction } from "./admin-action-log";

/* ── DTOs ────────────────────────────────────────────────────── */




export interface PostRow {
  id: string;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  authorEmail: string | null;
  body: string;
  images: Array<{ url: string; alt?: string | null }>;
  /**
   * A moderator has to be able to watch what they're moderating —
   * judging a reported post from its caption alone is not moderation.
   */
  video: PostVideo | null;
  isAnonymous: boolean;
  status: PostStatus;
  isFeatured: boolean;
  removedReason: string | null;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  reportCount: number;
  countryId: string | null;
  countryName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommentRow {
  id: string;
  postId: string;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  body: string;
  isAnonymous: boolean;
  status: PostStatus;
  likeCount: number;
  reportCount: number;
  removedReason: string | null;
  createdAt: string;
}

export interface ReportRow {
  id: string;
  targetType: ReportTargetType;
  postId: string;
  commentId: string | null;
  reporterId: string | null;
  reporterName: string | null;
  reason: string;
  notes: string | null;
  status: ReportStatus;
  resolvedByName: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
  // Snippet of the reported content for at-a-glance triage.
  targetPreview: string;
  targetAuthorName: string;
}

/* ── List / read ─────────────────────────────────────────────── */

const MAX_PER_PAGE = 100;

export type PostStatusFilter = "all" | "published" | "pending" | "removed" | "reported";

export interface ListPostsOptions {
  q?: string;
  status?: PostStatusFilter;
  authorId?: string;
  countryId?: string;
  onlyFeatured?: boolean;
  page: number;
  perPage: number;
}

function parseImages(raw: unknown): Array<{ url: string; alt?: string | null }> {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (item && typeof item === "object" && "url" in item && typeof (item as { url: unknown }).url === "string") {
      const cast = item as { url: string; alt?: unknown };
      return [{ url: cast.url, alt: typeof cast.alt === "string" ? cast.alt : null }];
    }
    return [];
  });
}

export async function listPosts(opts: ListPostsOptions): Promise<{
  items: PostRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}> {
  const q = (opts.q ?? "").trim();
  const status = opts.status ?? "all";
  const page = Math.max(1, opts.page);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(5, opts.perPage));

  const where: Prisma.PostWhereInput = {};
  if (q) {
    where.OR = [
      { body: { contains: q } },
      { authorNameSnapshot: { contains: q } },
      { id: q },
    ];
  }
  if (status === "published") where.status = "PUBLISHED";
  else if (status === "pending") where.status = "PENDING";
  else if (status === "removed") where.status = "REMOVED";
  else if (status === "reported") where.reportCount = { gt: 0 };
  if (opts.authorId) where.authorId = opts.authorId;
  if (opts.countryId) where.countryId = opts.countryId;
  if (opts.onlyFeatured) where.isFeatured = true;

  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: {
        author: { select: { id: true, email: true, displayName: true, avatarUrl: true } },
        country: { select: { id: true, name: true } },
      },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.post.count({ where }),
  ]);

  return {
    items: rows.map((p) => ({
      id: p.id,
      authorId: p.authorId,
      authorName: p.authorNameSnapshot,
      authorAvatar: p.authorAvatarSnapshot ?? p.author?.avatarUrl ?? null,
      authorEmail: p.author?.email ?? null,
      body: p.body,
      images: parseImages(p.images),
      video: parseVideo(p.video),
      isAnonymous: p.isAnonymous,
      status: p.status,
      isFeatured: p.isFeatured,
      removedReason: p.removedReason,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      saveCount: p.saveCount,
      reportCount: p.reportCount,
      countryId: p.countryId,
      countryName: p.country?.name ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getPost(id: string): Promise<PostRow | null> {
  const p = await prisma.post.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, email: true, displayName: true, avatarUrl: true } },
      country: { select: { id: true, name: true } },
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    authorId: p.authorId,
    authorName: p.authorNameSnapshot,
    authorAvatar: p.authorAvatarSnapshot ?? p.author?.avatarUrl ?? null,
    authorEmail: p.author?.email ?? null,
    body: p.body,
    images: parseImages(p.images),
    video: parseVideo(p.video),
    isAnonymous: p.isAnonymous,
    status: p.status,
    isFeatured: p.isFeatured,
    removedReason: p.removedReason,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    saveCount: p.saveCount,
    reportCount: p.reportCount,
    countryId: p.countryId,
    countryName: p.country?.name ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function listComments(postId: string): Promise<CommentRow[]> {
  const rows = await prisma.postComment.findMany({
    where: { postId },
    orderBy: [{ createdAt: "asc" }],
    include: {
      author: { select: { displayName: true, avatarUrl: true } },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    postId: c.postId,
    authorId: c.authorId,
    authorName: c.authorNameSnapshot,
    authorAvatar: c.authorAvatarSnapshot ?? c.author?.avatarUrl ?? null,
    body: c.body,
    isAnonymous: c.isAnonymous,
    status: c.status,
    likeCount: c.likeCount,
    reportCount: c.reportCount,
    removedReason: c.removedReason,
    createdAt: c.createdAt.toISOString(),
  }));
}

/* ── Post moderation ─────────────────────────────────────────── */

export async function removePost(
  actorId: string,
  id: string,
  reason?: string,
): Promise<void> {
  const before = await prisma.post.findUnique({ where: { id }, select: { status: true } });
  if (!before) throw new Error("Post not found");
  if (before.status === "REMOVED") return;
  await prisma.post.update({
    where: { id },
    data: { status: PostStatus.REMOVED, removedReason: reason ?? null },
  });
  await logAdminAction({
    adminId: actorId,
    action: AdminAction.POST_REMOVED,
    reason,
    meta: { postId: id } as unknown as Prisma.InputJsonValue,
  });
}

/**
 * Permanent delete, media included.
 *
 * Deliberately separate from `removePost`, which is the reversible
 * moderation action — a removed post can be restored, so its files
 * must survive. This one is the storage-reclaiming door, and there is
 * no way back from it.
 *
 * `allowAnyOwner` is set because the admin is deleting a member's
 * post: the files belong to that member, not to the admin, and the
 * ownership check that protects members from each other must not stop
 * a moderator here.
 */
export async function purgePost(actorId: string, id: string): Promise<{ bytesFreed: number }> {
  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, authorId: true, images: true, video: true, body: true },
  });
  if (!post) throw new Error("Post not found");

  await prisma.post.delete({ where: { id } });

  const media = await deleteMediaByUrls(
    [...postImageUrls(post.images), ...extractLocalImageUrls(post.body)],
    { allowAnyOwner: true },
  );

  let bytesFreed = media.bytesFreed;
  const video = parseVideo(post.video);
  if (video?.assetId) {
    await discardVideo(video.assetId, { id: actorId, isAdmin: true }).catch(() => {});
  }

  await logAdminAction({
    adminId: actorId,
    action: AdminAction.POST_REMOVED,
    reason: "Permanently deleted",
    meta: {
      postId: id,
      authorId: post.authorId,
      filesDeleted: media.deleted.length,
      bytesFreed,
    } as unknown as Prisma.InputJsonValue,
  });

  return { bytesFreed };
}

export async function restorePost(actorId: string, id: string): Promise<void> {
  const before = await prisma.post.findUnique({ where: { id }, select: { status: true } });
  if (!before) throw new Error("Post not found");
  if (before.status === "PUBLISHED") return;
  await prisma.post.update({
    where: { id },
    data: { status: PostStatus.PUBLISHED, removedReason: null },
  });
  await logAdminAction({
    adminId: actorId,
    action: AdminAction.POST_RESTORED,
    meta: { postId: id } as unknown as Prisma.InputJsonValue,
  });
}

export async function setPostFeatured(
  actorId: string,
  id: string,
  featured: boolean,
): Promise<void> {
  const before = await prisma.post.findUnique({ where: { id }, select: { isFeatured: true } });
  if (!before) throw new Error("Post not found");
  if (before.isFeatured === featured) return;
  await prisma.post.update({
    where: { id },
    data: {
      isFeatured: featured,
      featuredAt: featured ? new Date() : null,
    },
  });
  await logAdminAction({
    adminId: actorId,
    action: featured ? AdminAction.POST_FEATURED : AdminAction.POST_UNFEATURED,
    meta: { postId: id } as unknown as Prisma.InputJsonValue,
  });
}

/* ── Comment moderation ──────────────────────────────────────── */

export async function removeComment(
  actorId: string,
  commentId: string,
  reason?: string,
): Promise<void> {
  const c = await prisma.postComment.findUnique({
    where: { id: commentId },
    select: { postId: true, status: true },
  });
  if (!c) throw new Error("Comment not found");
  if (c.status === "REMOVED") return;
  await prisma.$transaction([
    prisma.postComment.update({
      where: { id: commentId },
      data: { status: PostStatus.REMOVED, removedReason: reason ?? null },
    }),
    prisma.post.update({
      where: { id: c.postId },
      data: { commentCount: { decrement: 1 } },
    }),
  ]);
  await logAdminAction({
    adminId: actorId,
    action: AdminAction.COMMENT_REMOVED,
    reason,
    meta: { commentId, postId: c.postId } as unknown as Prisma.InputJsonValue,
  });
}

export async function restoreComment(actorId: string, commentId: string): Promise<void> {
  const c = await prisma.postComment.findUnique({
    where: { id: commentId },
    select: { postId: true, status: true },
  });
  if (!c) throw new Error("Comment not found");
  if (c.status === "PUBLISHED") return;
  await prisma.$transaction([
    prisma.postComment.update({
      where: { id: commentId },
      data: { status: PostStatus.PUBLISHED, removedReason: null },
    }),
    prisma.post.update({
      where: { id: c.postId },
      data: { commentCount: { increment: 1 } },
    }),
  ]);
  await logAdminAction({
    adminId: actorId,
    action: AdminAction.COMMENT_RESTORED,
    meta: { commentId, postId: c.postId } as unknown as Prisma.InputJsonValue,
  });
}

/* ── Reports queue ───────────────────────────────────────────── */

export type ReportStatusFilter = "all" | "open" | "resolved" | "dismissed";

export interface ListReportsOptions {
  status?: ReportStatusFilter;
  reason?: string;
  page: number;
  perPage: number;
}

export async function listReports(opts: ListReportsOptions): Promise<{
  items: ReportRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}> {
  const status = opts.status ?? "open";
  const page = Math.max(1, opts.page);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(5, opts.perPage));

  const where: Prisma.PostReportWhereInput = {};
  if (status === "open") where.status = ReportStatus.OPEN;
  else if (status === "resolved") where.status = ReportStatus.RESOLVED;
  else if (status === "dismissed") where.status = ReportStatus.DISMISSED;
  if (opts.reason) where.reason = opts.reason as Prisma.PostReportWhereInput["reason"];

  const [rows, total] = await Promise.all([
    prisma.postReport.findMany({
      where,
      // Open first, then newest.
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        reporter: { select: { displayName: true } },
        resolvedBy: { select: { displayName: true } },
        post: { select: { body: true, authorNameSnapshot: true } },
      },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.postReport.count({ where }),
  ]);

  // Comment previews need a separate lookup — cheap batch to avoid
  // an N+1 across the page.
  const commentIds = rows
    .filter((r) => r.commentId)
    .map((r) => r.commentId!)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  const commentPreviews = new Map<string, { body: string; authorNameSnapshot: string }>();
  if (commentIds.length > 0) {
    const cs = await prisma.postComment.findMany({
      where: { id: { in: commentIds } },
      select: { id: true, body: true, authorNameSnapshot: true },
    });
    for (const c of cs) commentPreviews.set(c.id, { body: c.body, authorNameSnapshot: c.authorNameSnapshot });
  }

  return {
    items: rows.map((r) => {
      const isComment = r.targetType === "COMMENT" && r.commentId;
      const commentSrc = isComment ? commentPreviews.get(r.commentId!) : undefined;
      const preview = commentSrc?.body ?? r.post.body;
      const authorName = commentSrc?.authorNameSnapshot ?? r.post.authorNameSnapshot;
      return {
        id: r.id,
        targetType: r.targetType,
        postId: r.postId,
        commentId: r.commentId,
        reporterId: r.reporterId,
        reporterName: r.reporter?.displayName ?? null,
        reason: r.reason,
        notes: r.notes,
        status: r.status,
        resolvedByName: r.resolvedBy?.displayName ?? null,
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        resolution: r.resolution,
        createdAt: r.createdAt.toISOString(),
        targetPreview: preview.length > 240 ? `${preview.slice(0, 240)}…` : preview,
        targetAuthorName: authorName,
      };
    }),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/**
 * Resolve a report. `outcome`:
 *   • "remove" — hide the target (post or comment) and mark resolved
 *   • "keep"   — leave the content live but close the report
 *   • "dismiss"— mark dismissed (bad-faith report)
 */
export async function resolveReport(
  actorId: string,
  id: string,
  outcome: "remove" | "keep" | "dismiss",
  resolutionNote?: string,
): Promise<void> {
  const report = await prisma.postReport.findUnique({ where: { id } });
  if (!report) throw new Error("Report not found");
  if (report.status !== ReportStatus.OPEN) return;

  if (outcome === "remove") {
    if (report.targetType === "POST") {
      await removePost(actorId, report.postId, resolutionNote);
    } else if (report.commentId) {
      await removeComment(actorId, report.commentId, resolutionNote);
    }
  }

  const newStatus = outcome === "dismiss" ? ReportStatus.DISMISSED : ReportStatus.RESOLVED;
  await prisma.postReport.update({
    where: { id },
    data: {
      status: newStatus,
      resolvedById: actorId,
      resolvedAt: new Date(),
      resolution: resolutionNote ?? null,
      // Releases the unique key. Without this, a member who reported
      // something once could never report it again after a moderator
      // closed the first one — including when the same person posts
      // the same thing a month later.
      openKey: null,
    },
  });

  await logAdminAction({
    adminId: actorId,
    action:
      outcome === "dismiss"
        ? AdminAction.REPORT_DISMISSED
        : AdminAction.REPORT_RESOLVED,
    reason: resolutionNote,
    meta: {
      reportId: id,
      postId: report.postId,
      commentId: report.commentId,
      outcome,
    } as unknown as Prisma.InputJsonValue,
  });
}

/* ── Overview stats ─────────────────────────────────────────── */

export interface PostStats {
  postsTotal: number;
  postsPublished: number;
  postsRemoved: number;
  commentsTotal: number;
  reportsOpen: number;
  reportsResolvedLast7d: number;
}

export async function getPostStats(): Promise<PostStats> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    postsTotal,
    postsPublished,
    postsRemoved,
    commentsTotal,
    reportsOpen,
    reportsResolvedLast7d,
  ] = await Promise.all([
    prisma.post.count(),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
    prisma.post.count({ where: { status: "REMOVED" } }),
    prisma.postComment.count(),
    prisma.postReport.count({ where: { status: ReportStatus.OPEN } }),
    prisma.postReport.count({
      where: {
        status: { in: [ReportStatus.RESOLVED, ReportStatus.DISMISSED] },
        resolvedAt: { gte: sevenDaysAgo },
      },
    }),
  ]);
  return {
    postsTotal,
    postsPublished,
    postsRemoved,
    commentsTotal,
    reportsOpen,
    reportsResolvedLast7d,
  };
}
