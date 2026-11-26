/**
 * Reader-side article queries — the public magazine.
 *
 * Only PUBLISHED articles are ever returned here; drafts and archived
 * pieces are admin-only and live in `articles-admin.ts`.
 *
 * Engagement (likes, saves, comments) uses the loose-FK convention:
 * rows carry a plain `userId` and, for comments, display snapshots, so
 * nothing joins the User table and a deleted account doesn't cascade
 * away the discussion.
 */

import { reactionOutcome, commentReactionResult } from "./reaction-toggle";
import type { ReactionType } from "./reactions";
import { prisma } from "./db";
import { getBlockedIds } from "./blocks";

const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverUrl: true,
  coverAlt: true,
  videoUrl: true,
  readMinutes: true,
  publishedAt: true,
  viewCount: true,
  likeCount: true,
  saveCount: true,
  commentCount: true,
  authorNameSnapshot: true,
  authorAvatarSnapshot: true,
  category: { select: { id: true, name: true, slug: true } },
} as const;

export interface ArticleFeedFilters {
  categorySlug?: string;
  q?: string;
  page?: number;
  perPage?: number;
  featuredOnly?: boolean;
}

export async function listPublishedArticles(filters: ArticleFeedFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(48, Math.max(1, filters.perPage ?? 12));

  const where: {
    status: "PUBLISHED";
    isFeatured?: boolean;
    category?: { slug: string };
    OR?: { title?: { contains: string }; excerpt?: { contains: string } }[];
  } = { status: "PUBLISHED" };

  if (filters.featuredOnly) where.isFeatured = true;
  if (filters.categorySlug) where.category = { slug: filters.categorySlug };
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [{ title: { contains: q } }, { excerpt: { contains: q } }];
  }

  const [rows, total] = await Promise.all([
    prisma.article.findMany({
      where,
      // Newest published first; fall back to createdAt for anything
      // published before the column existed.
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: CARD_SELECT,
    }),
    prisma.article.count({ where }),
  ]);

  return {
    articles: rows,
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

/** Categories that actually have something published in them. */
/**
 * Every category, for the tile grid on /articles.
 *
 * DIFFERENT FROM `listReaderCategories`, which drops empty ones
 * because it feeds a filter dropdown and a filter that returns nothing
 * is a trap. A TILE GRID is the opposite case: the tiles are the map
 * of what this section covers, so an empty one still tells a reader
 * what belongs here and a writer what to write. Same reasoning as the
 * event category chips.
 *
 * The latest publish date rides along so a tile can say how fresh a
 * category is rather than only how big it is.
 */
export interface ArticleCategoryTile {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  count: number;
  latestAt: string | null;
}

export async function listCategoryTiles(): Promise<ArticleCategoryTile[]> {
  const [cats, latest] = await Promise.all([
    prisma.articleCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, slug: true, description: true, emoji: true, color: true,
        _count: { select: { articles: { where: { status: "PUBLISHED" } } } },
      },
    }),
    prisma.article.groupBy({
      by: ["categoryId"],
      where: { status: "PUBLISHED", categoryId: { not: null } },
      _max: { publishedAt: true },
    }),
  ]);

  const newest = new Map<string, Date | null>();
  for (const row of latest) {
    if (row.categoryId) newest.set(row.categoryId, row._max.publishedAt);
  }

  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    emoji: c.emoji,
    color: c.color,
    count: c._count.articles,
    latestAt: newest.get(c.id)?.toISOString() ?? null,
  }));
}

/**
 * Slugs an article may not take, because a route already owns them.
 *
 * /articles/category/<slug> is a static segment sitting beside
 * /articles/<slug>. Next resolves the static one first, so an article
 * slugged "category" would not break the section page — it would make
 * the ARTICLE unreachable, silently, for as long as it existed. The
 * rest are here for the same reason or reserved against pages that are
 * cheap to add later.
 */
export const RESERVED_ARTICLE_SLUGS = new Set([
  "category",
  "categories",
  "new",
  "edit",
  "draft",
  "drafts",
  "mine",
  "search",
  "tag",
  "tags",
  "feed",
  "rss",
]);

/** One category by slug, or null. Used by the category page. */
export async function getCategoryBySlug(slug: string): Promise<ArticleCategoryTile | null> {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  const all = await listCategoryTiles();
  return all.find((c) => c.slug === clean) ?? null;
}

export async function listReaderCategories() {
  const rows = await prisma.articleCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { articles: { where: { status: "PUBLISHED" } } } },
    },
  });
  return rows
    .filter((c) => c._count.articles > 0)
    .map((c) => ({ id: c.id, name: c.name, slug: c.slug, count: c._count.articles }));
}

export async function getPublishedArticle(slug: string, viewerId?: string | null) {
  const article = await prisma.article.findFirst({
    where: { slug, status: "PUBLISHED" },
    // The gallery is on the reader page only. Listing pages show the
    // cover and nothing else, so they never pay for a JSON column they
    // do not render — the same split campaigns and places use.
    select: { ...CARD_SELECT, body: true, photos: true },
  });
  if (!article) return null;

  // Viewer-specific flags are two cheap PK lookups rather than joins.
  let liked = false;
  let myReaction: ReactionType | null = null;
  let saved = false;
  if (viewerId) {
    const [like, save] = await Promise.all([
      prisma.articleLike.findUnique({
        where: { articleId_userId: { articleId: article.id, userId: viewerId } },
        select: { userId: true, type: true },
      }),
      prisma.articleSave.findUnique({
        where: { articleId_userId: { articleId: article.id, userId: viewerId } },
        select: { userId: true },
      }),
    ]);
    liked = !!like;
    myReaction = (like?.type as ReactionType) ?? null;
    saved = !!save;
  }

  return { ...article, liked, myReaction, saved };
}

/**
 * Fire-and-forget view counter. Deliberately not deduplicated — a
 * rough popularity signal is enough, and per-viewer tracking would
 * mean another table for very little benefit.
 */
export async function recordArticleView(id: string): Promise<void> {
  await prisma.article
    .update({ where: { id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});
}

/**
 * More from the same category, excluding the piece being read.
 *
 * Backfills with the newest articles from anywhere if the category is
 * thin — a category with only one article would otherwise show an
 * awkward single card (or none at all), so the reader always gets a
 * full row where the content exists.
 */
export async function listRelatedArticles(articleId: string, categoryId: string | null, take = 3) {
  const sameCategory = categoryId
    ? await prisma.article.findMany({
        where: { status: "PUBLISHED", id: { not: articleId }, categoryId },
        orderBy: [{ publishedAt: "desc" }],
        take,
        select: CARD_SELECT,
      })
    : [];

  if (sameCategory.length >= take) return sameCategory;

  const exclude = [articleId, ...sameCategory.map((a) => a.id)];
  const filler = await prisma.article.findMany({
    where: { status: "PUBLISHED", id: { notIn: exclude } },
    orderBy: [{ publishedAt: "desc" }],
    take: take - sameCategory.length,
    select: CARD_SELECT,
  });
  return [...sameCategory, ...filler];
}

/* ── engagement ──────────────────────────────────────────────── */

/**
 * Leave, change or take back a reaction. Returns the new state.
 *
 * The count is a recount of the rows, not an increment, so the
 * "changed their mind" case needs no special handling here — one
 * person still holds one row either way. reaction-toggle.ts explains
 * why that case matters on the surfaces that DO increment.
 */
export async function toggleArticleLike(articleId: string, userId: string, rawType?: unknown) {
  const key = { articleId_userId: { articleId, userId } };
  const existing = await prisma.articleLike.findUnique({ where: key, select: { type: true } });
  const outcome = reactionOutcome((existing?.type as ReactionType) ?? null, rawType);

  if (outcome.kind === "removed") await prisma.articleLike.delete({ where: key });
  else if (outcome.kind === "changed")
    await prisma.articleLike.update({ where: key, data: { type: outcome.type } });
  else await prisma.articleLike.create({ data: { articleId, userId, type: outcome.type } });

  // Recount rather than increment — self-healing if a write is ever lost.
  const likeCount = await prisma.articleLike.count({ where: { articleId } });
  await prisma.article.update({ where: { id: articleId }, data: { likeCount } });
  return {
    liked: outcome.kind !== "removed",
    likeCount,
    myReaction: outcome.kind === "removed" ? null : outcome.type,
  };
}

export async function toggleArticleSave(articleId: string, userId: string) {
  const key = { articleId_userId: { articleId, userId } };
  const existing = await prisma.articleSave.findUnique({ where: key, select: { userId: true } });

  if (existing) {
    await prisma.articleSave.delete({ where: key });
  } else {
    await prisma.articleSave.create({ data: { articleId, userId } });
  }
  const saveCount = await prisma.articleSave.count({ where: { articleId } });
  await prisma.article.update({ where: { id: articleId }, data: { saveCount } });
  return { saved: !existing, saveCount };
}

/**
 * All published comments for an article as a FLAT list, oldest first,
 * each carrying its `parentId` so the client can nest them. Flat is
 * deliberate: one query regardless of thread shape, and the ordering
 * stays stable however the UI chooses to group them.
 */
export async function listArticleComments(articleId: string, viewerId?: string | null) {
  /* Blocked authors drop out here, the same way they do for post
     comments (see the `blockedIds` option in @/lib/comments). Without
     it, blocking somebody silenced them on the wall but they carried
     on appearing under every article and clip — which reads as the
     block having quietly stopped working. */
  const blockedIds = viewerId ? await getBlockedIds(viewerId) : [];

  const comments = await prisma.articleComment.findMany({
    where: {
      articleId,
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
  if (!viewerId || comments.length === 0) {
    return comments.map((c) => ({ ...c, liked: false, myReaction: null }));
  }
  // One query for the viewer's likes across every comment on the page.
  const likes = await prisma.articleCommentLike.findMany({
    where: { userId: viewerId, commentId: { in: comments.map((c) => c.id) } },
    select: { commentId: true, type: true },
  });
  const mine = new Map(likes.map((l) => [l.commentId, l.type as ReactionType]));
  return comments.map((c) => ({ ...c, liked: mine.has(c.id), myReaction: mine.get(c.id) ?? null }));
}

/** Leave, change or take back a reaction on a comment. */
export async function toggleArticleCommentLike(
  commentId: string,
  userId: string,
  rawType?: unknown,
) {
  const comment = await prisma.articleComment.findFirst({
    where: { id: commentId, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!comment) throw new Error("Comment not found");

  const key = { commentId_userId: { commentId, userId } };
  const existing = await prisma.articleCommentLike.findUnique({ where: key, select: { type: true } });
  const outcome = reactionOutcome((existing?.type as ReactionType) ?? null, rawType);

  if (outcome.kind === "removed") await prisma.articleCommentLike.delete({ where: key });
  else if (outcome.kind === "changed")
    await prisma.articleCommentLike.update({ where: key, data: { type: outcome.type } });
  else await prisma.articleCommentLike.create({ data: { commentId, userId, type: outcome.type } });

  // Recounted, never incremented.
  const likeCount = await prisma.articleCommentLike.count({ where: { commentId } });
  await prisma.articleComment.update({ where: { id: commentId }, data: { likeCount } });

  return commentReactionResult(outcome, likeCount);
}

export async function addArticleComment(input: {
  articleId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  body: string;
  isAnonymous?: boolean;
  parentId?: string | null;
}) {
  const body = input.body.trim();
  if (!body) throw new Error("Comment cannot be empty");

  const article = await prisma.article.findFirst({
    where: { id: input.articleId, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!article) throw new Error("Article not found");

  // Resolve the parent, if any. Threads are capped at one level: a
  // reply to a reply is re-parented to the top-level comment, so the
  // UI never has to indent indefinitely. Also guards against replying
  // to a comment on a DIFFERENT article.
  let parentId: string | null = null;
  if (input.parentId) {
    const parent = await prisma.articleComment.findFirst({
      where: { id: input.parentId, articleId: input.articleId, status: "PUBLISHED" },
      select: { id: true, parentId: true },
    });
    if (!parent) throw new Error("Comment not found");
    parentId = parent.parentId ?? parent.id;
  }

  const comment = await prisma.articleComment.create({
    data: {
      articleId: input.articleId,
      authorId: input.userId,
      authorNameSnapshot: input.displayName,
      authorAvatarSnapshot: input.avatarUrl ?? null,
      body: body.slice(0, 4000),
      isAnonymous: input.isAnonymous ?? false,
      parentId,
    },
  });

  const commentCount = await prisma.articleComment.count({
    where: { articleId: input.articleId, status: "PUBLISHED" },
  });
  await prisma.article.update({ where: { id: input.articleId }, data: { commentCount } });

  return { comment, commentCount };
}

/** A commenter may delete their own comment; admins use the admin lib. */
export async function deleteOwnArticleComment(commentId: string, userId: string) {
  const comment = await prisma.articleComment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, articleId: true },
  });
  if (!comment || comment.authorId !== userId) throw new Error("Not found");

  await prisma.articleComment.delete({ where: { id: commentId } });
  const commentCount = await prisma.articleComment.count({
    where: { articleId: comment.articleId, status: "PUBLISHED" },
  });
  await prisma.article.update({ where: { id: comment.articleId }, data: { commentCount } });
  return { commentCount };
}

/** Articles the viewer bookmarked, newest-save first. */
export async function listSavedArticles(userId: string, take = 50) {
  const rows = await prisma.articleSave.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: { createdAt: true, article: { select: CARD_SELECT } },
  });
  return rows
    .filter((r) => r.article)
    .map((r) => ({ savedAt: r.createdAt, ...r.article }));
}
