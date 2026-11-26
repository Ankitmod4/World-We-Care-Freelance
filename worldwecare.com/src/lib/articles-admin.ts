/**
 * Admin-side article management — the magazine surface from the
 * project plan ("Magazine-style article reader (admin-authored
 * articles)").
 *
 * Articles are authored by admins, stored as the Markdown subset that
 * `src/lib/rich-text.tsx` renders safely, and published on their own
 * schedule (draft → published → archived).
 *
 * Author identity is stored as a scalar admin id plus display
 * snapshots, matching the convention used by chat, gratitude and
 * confessions — so these helpers never join the AdminUser table and a
 * removed admin doesn't erase a byline.
 */

import { Prisma } from "@prisma/client";
import { attachedImageUrls, sanitiseImages, MAX_GALLERY_PHOTOS } from "./attached-media";
import { prisma } from "./db";
import { slugify } from "./geography-admin";
import { RESERVED_ARTICLE_SLUGS } from "./articles";
import { deleteMediaByUrls, extractLocalImageUrls } from "./media";
import { estimateReadMinutes } from "./rich-text";

export type ArticleStatusValue = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/* ── slugs ───────────────────────────────────────────────────── */

async function uniqueArticleSlug(base: string, excludeId?: string): Promise<string> {
  const raw = slugify(base) || "article";
  // A reserved slug is shunted rather than refused: an author titling a
  // piece "Category" has done nothing wrong, and failing their save to
  // protect a route would be an odd thing to explain. See
  // RESERVED_ARTICLE_SLUGS.
  const root = RESERVED_ARTICLE_SLUGS.has(raw) ? `${raw}-article` : raw;
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await prisma.article.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

async function uniqueArticleCategorySlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "category";
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await prisma.articleCategory.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

/* ── categories ──────────────────────────────────────────────── */

/** Accept "#abc" / "#aabbcc" only — this lands in an inline style. */
function cleanColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;
  return /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null;
}

function cleanEmoji(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return v ? Array.from(v)[0] ?? null : null;
}

export async function listArticleCategories() {
  const rows = await prisma.articleCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { articles: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    emoji: c.emoji,
    color: c.color,
    sortOrder: c.sortOrder,
    articleCount: c._count.articles,
  }));
}

export async function createArticleCategory(input: {
  name: string;
  description?: string | null;
  emoji?: string | null;
  color?: string | null;
  sortOrder?: number;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  const slug = await uniqueArticleCategorySlug(name);
  return prisma.articleCategory.create({
    data: {
      name,
      slug,
      description: input.description?.trim() || null,
      emoji: cleanEmoji(input.emoji),
      color: cleanColor(input.color),
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function updateArticleCategory(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    emoji?: string | null;
    color?: string | null;
    sortOrder?: number;
  },
) {
  const data: Prisma.ArticleCategoryUpdateInput = {};
  if (typeof input.name === "string") {
    const name = input.name.trim();
    if (!name) throw new Error("Name is required");
    data.name = name;
    data.slug = await uniqueArticleCategorySlug(name, id);
  }
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.emoji !== undefined) data.emoji = cleanEmoji(input.emoji);
  if (input.color !== undefined) data.color = cleanColor(input.color);
  if (typeof input.sortOrder === "number") data.sortOrder = input.sortOrder;
  return prisma.articleCategory.update({ where: { id }, data });
}

/**
 * Deleting a category leaves its articles in place — `categoryId` is
 * SetNull, so they become "uncategorised" rather than disappearing.
 */
export async function deleteArticleCategory(id: string) {
  return prisma.articleCategory.delete({ where: { id } });
}

/* ── articles ────────────────────────────────────────────────── */

export interface ArticleListFilters {
  q?: string;
  status?: ArticleStatusValue | "ALL";
  categoryId?: string;
  page?: number;
  perPage?: number;
}

export async function listArticles(filters: ArticleListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(1, filters.perPage ?? 20));

  const where: Prisma.ArticleWhereInput = {};
  if (filters.status && filters.status !== "ALL") where.status = filters.status;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [{ title: { contains: q } }, { excerpt: { contains: q } }];
  }

  const [rows, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: { category: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.article.count({ where }),
  ]);

  return {
    articles: rows.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      coverUrl: a.coverUrl,
      status: a.status,
      isFeatured: a.isFeatured,
      publishedAt: a.publishedAt,
      readMinutes: a.readMinutes,
      viewCount: a.viewCount,
      likeCount: a.likeCount,
      commentCount: a.commentCount,
      authorName: a.authorNameSnapshot,
      category: a.category,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getArticle(id: string) {
  return prisma.article.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
}

export interface ArticleWriteInput {
  title: string;
  body: string;
  excerpt?: string | null;
  coverUrl?: string | null;
  coverAlt?: string | null;
  videoUrl?: string | null;
  categoryId?: string | null;
  status?: ArticleStatusValue;
  isFeatured?: boolean;
  /** Photos that go WITH the piece rather than inside it. Capped at MAX_GALLERY_PHOTOS. */
  photos?: Array<{ url?: unknown; alt?: unknown }> | null;
}

/**
 * The gallery column, sanitised.
 *
 * `DbNull` and not `undefined` when it comes back empty: undefined
 * means "leave the column alone" on an update, so an editor removing
 * the last photo would silently keep it. Same shape and same trick as
 * campaigns-admin and places-admin — one of these three getting it
 * wrong is how a gallery becomes impossible to clear.
 */
function galleryColumn(
  photos: Array<{ url?: unknown; alt?: unknown }> | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  const list = sanitiseImages(photos, MAX_GALLERY_PHOTOS);
  return list.length ? (list as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
}

function cleanOptional(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function createArticle(
  input: ArticleWriteInput,
  author: { id: string; displayName: string },
) {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");
  const body = input.body ?? "";
  if (!body.trim()) throw new Error("Body is required");

  const status: ArticleStatusValue = input.status ?? "DRAFT";
  const slug = await uniqueArticleSlug(title);

  return prisma.article.create({
    data: {
      slug,
      title: title.slice(0, 200),
      body,
      excerpt: cleanOptional(input.excerpt)?.slice(0, 400) ?? null,
      coverUrl: cleanOptional(input.coverUrl),
      coverAlt: cleanOptional(input.coverAlt),
      videoUrl: cleanOptional(input.videoUrl),
      categoryId: cleanOptional(input.categoryId),
      status,
      isFeatured: input.isFeatured ?? false,
      featuredAt: input.isFeatured ? new Date() : null,
      // Stamp the publish time the moment it first goes live so the
      // reader can sort by it.
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      photos: galleryColumn(input.photos),
      readMinutes: estimateReadMinutes(body),
      authorAdminId: author.id,
      authorNameSnapshot: author.displayName,
    },
  });
}

export async function updateArticle(id: string, input: Partial<ArticleWriteInput>) {
  const existing = await prisma.article.findUnique({
    where: { id },
    select: { publishedAt: true, isFeatured: true },
  });
  if (!existing) throw new Error("Article not found");

  const data: Prisma.ArticleUpdateInput = {};

  if (typeof input.title === "string") {
    const title = input.title.trim();
    if (!title) throw new Error("Title is required");
    data.title = title.slice(0, 200);
    data.slug = await uniqueArticleSlug(title, id);
  }
  if (typeof input.body === "string") {
    if (!input.body.trim()) throw new Error("Body is required");
    data.body = input.body;
    data.readMinutes = estimateReadMinutes(input.body);
  }
  if (input.excerpt !== undefined) data.excerpt = cleanOptional(input.excerpt)?.slice(0, 400) ?? null;
  if (input.coverUrl !== undefined) data.coverUrl = cleanOptional(input.coverUrl);
  if (input.coverAlt !== undefined) data.coverAlt = cleanOptional(input.coverAlt);
  if (input.videoUrl !== undefined) data.videoUrl = cleanOptional(input.videoUrl);
  if (input.photos !== undefined) data.photos = galleryColumn(input.photos);
  if (input.categoryId !== undefined) {
    const categoryId = cleanOptional(input.categoryId);
    data.category = categoryId ? { connect: { id: categoryId } } : { disconnect: true };
  }
  if (input.status !== undefined) {
    data.status = input.status;
    // First transition to PUBLISHED stamps publishedAt; later edits
    // keep the original date so "published on" doesn't jump around.
    if (input.status === "PUBLISHED" && !existing.publishedAt) data.publishedAt = new Date();
  }
  if (input.isFeatured !== undefined) {
    data.isFeatured = input.isFeatured;
    data.featuredAt = input.isFeatured ? (existing.isFeatured ? undefined : new Date()) : null;
  }

  return prisma.article.update({ where: { id }, data });
}

export async function deleteArticle(id: string) {
  const article = await prisma.article.findUnique({
    where: { id },
    select: { coverUrl: true, body: true, photos: true },
  });

  // Comments, likes and saves cascade at the DB level.
  const deleted = await prisma.article.delete({ where: { id } });

  // The cover, THE GALLERY, and every inline image in the Markdown
  // body — those are real uploads that nothing else points at once the
  // article is gone. Without the gallery here, deleting an article
  // leaves every photo but the cover on disk with nothing pointing at
  // it, which is the bug campaigns and places already had once.
  await deleteMediaByUrls(
    [
      article?.coverUrl,
      ...attachedImageUrls(article?.photos),
      ...extractLocalImageUrls(article?.body),
    ],
    { allowAnyOwner: true },
  );

  return deleted;
}

/** Admin view of an article's comments, including removed ones. */
export async function listArticleComments(articleId: string) {
  return prisma.articleComment.findMany({
    where: { articleId },
    orderBy: { createdAt: "desc" },
  });
}

export async function setArticleCommentStatus(
  commentId: string,
  status: "PUBLISHED" | "REMOVED",
  removedReason?: string | null,
) {
  const comment = await prisma.articleComment.update({
    where: { id: commentId },
    data: { status, removedReason: status === "REMOVED" ? removedReason?.trim() || null : null },
  });
  // Keep the denormalised counter honest.
  const count = await prisma.articleComment.count({
    where: { articleId: comment.articleId, status: "PUBLISHED" },
  });
  await prisma.article.update({
    where: { id: comment.articleId },
    data: { commentCount: count },
  });
  return comment;
}
