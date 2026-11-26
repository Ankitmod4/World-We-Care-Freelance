/**
 * LibraryTheme — reader side.
 *
 * Themed pages for positive clips. A member follows a theme and can
 * like or save individual clips; everything shown here is curated by
 * an admin, so there is no status/approval machinery on this side.
 *
 * Embed URLs are stored raw and resolved at render time by
 * `src/lib/embeds.ts`. That is deliberate: a fix or a tightening of
 * the host whitelist then applies retroactively to every clip already
 * in the database, rather than only to ones added afterwards.
 */

import { reactionOutcome } from "./reaction-toggle";
import type { ReactionType } from "./reactions";
import { prisma } from "./db";

const CLIP_SELECT = {
  id: true,
  themeId: true,
  title: true,
  caption: true,
  kind: true,
  embedUrl: true,
  videoUrl: true,
  posterUrl: true,
  width: true,
  height: true,
  durationSec: true,
  likeCount: true,
  saveCount: true,
  commentCount: true,
  publishedAt: true,
  createdAt: true,
} as const;

const THEME_SELECT = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  coverUrl: true,
  emoji: true,
  followerCount: true,
  clipCount: true,
  sortOrder: true,
} as const;

/* ── themes ──────────────────────────────────────────────────── */

export async function listLibraryThemes(viewerId?: string | null) {
  const themes = await prisma.libraryTheme.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: THEME_SELECT,
  });
  if (!viewerId) return themes.map((t) => ({ ...t, following: false }));

  const follows = await prisma.themeFollow.findMany({
    where: { userId: viewerId, themeId: { in: themes.map((t) => t.id) } },
    select: { themeId: true },
  });
  const set = new Set(follows.map((f) => f.themeId));
  return themes.map((t) => ({ ...t, following: set.has(t.id) }));
}

export async function getLibraryThemeBySlug(slug: string, viewerId?: string | null) {
  const theme = await prisma.libraryTheme.findFirst({
    where: { slug, isActive: true },
    select: { ...THEME_SELECT, about: true },
  });
  if (!theme) return null;

  const following = viewerId
    ? !!(await prisma.themeFollow.findUnique({
        where: { themeId_userId: { themeId: theme.id, userId: viewerId } },
        select: { userId: true },
      }))
    : false;

  return { ...theme, following };
}

/* ── clips ───────────────────────────────────────────────────── */

/**
 * Clips for one theme, or across every theme the viewer follows.
 *
 * `liked`/`saved` are resolved in a second query rather than a
 * per-clip join — one extra round trip instead of N.
 */
export async function listClips(opts: {
  themeId?: string;
  /** Only clips from themes this user follows. */
  followedBy?: string;
  viewerId?: string | null;
  page?: number;
  perPage?: number;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const perPage = Math.min(48, Math.max(1, opts.perPage ?? 24));

  let themeFilter: { in: string[] } | string | undefined;
  if (opts.themeId) {
    themeFilter = opts.themeId;
  } else if (opts.followedBy) {
    const follows = await prisma.themeFollow.findMany({
      where: { userId: opts.followedBy },
      select: { themeId: true },
    });
    // No follows means no feed — and an empty `in` would match nothing
    // anyway, but being explicit saves the round trip.
    if (follows.length === 0) {
      return { clips: [], total: 0, page, perPage, pageCount: 1 };
    }
    themeFilter = { in: follows.map((f) => f.themeId) };
  }

  const where = {
    isPublished: true,
    theme: { isActive: true },
    ...(themeFilter ? { themeId: themeFilter } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.clip.findMany({
      where,
      orderBy: opts.themeId
        ? [{ sortOrder: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }]
        : [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        ...CLIP_SELECT,
        theme: { select: { slug: true, name: true, emoji: true } },
      },
    }),
    prisma.clip.count({ where }),
  ]);

  const marks = await viewerMarks(rows.map((r) => r.id), opts.viewerId);
  return {
    clips: rows.map((r) => ({
      ...r,
      liked: marks.liked.has(r.id),
      myReaction: marks.liked.get(r.id) ?? null,
      saved: marks.saved.has(r.id),
    })),
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

async function viewerMarks(clipIds: string[], viewerId?: string | null) {
  if (!viewerId || clipIds.length === 0) {
    return { liked: new Map<string, ReactionType>(), saved: new Set<string>() };
  }
  const [likes, saves] = await Promise.all([
    prisma.clipLike.findMany({
      where: { userId: viewerId, clipId: { in: clipIds } },
      select: { clipId: true, type: true },
    }),
    prisma.clipSave.findMany({
      where: { userId: viewerId, clipId: { in: clipIds } },
      select: { clipId: true },
    }),
  ]);
  return {
    liked: new Map(likes.map((l) => [l.clipId, l.type as ReactionType])),
    saved: new Set(saves.map((s) => s.clipId)),
  };
}

/* ── engagement ──────────────────────────────────────────────── */

export async function toggleThemeFollow(themeId: string, userId: string) {
  const key = { themeId_userId: { themeId, userId } };
  const existing = await prisma.themeFollow.findUnique({ where: key, select: { userId: true } });

  if (existing) await prisma.themeFollow.delete({ where: key });
  else await prisma.themeFollow.create({ data: { themeId, userId } });

  // Recount rather than increment — self-healing if a write is lost.
  const followerCount = await prisma.themeFollow.count({ where: { themeId } });
  await prisma.libraryTheme.update({ where: { id: themeId }, data: { followerCount } });
  return { following: !existing, followerCount };
}

/** Leave, change or take back a reaction. Count is a recount of rows. */
export async function toggleClipLike(clipId: string, userId: string, rawType?: unknown) {
  const key = { clipId_userId: { clipId, userId } };
  const existing = await prisma.clipLike.findUnique({ where: key, select: { type: true } });
  const outcome = reactionOutcome((existing?.type as ReactionType) ?? null, rawType);

  if (outcome.kind === "removed") await prisma.clipLike.delete({ where: key });
  else if (outcome.kind === "changed")
    await prisma.clipLike.update({ where: key, data: { type: outcome.type } });
  else await prisma.clipLike.create({ data: { clipId, userId, type: outcome.type } });

  const likeCount = await prisma.clipLike.count({ where: { clipId } });
  await prisma.clip.update({ where: { id: clipId }, data: { likeCount } });
  return {
    liked: outcome.kind !== "removed",
    likeCount,
    myReaction: outcome.kind === "removed" ? null : outcome.type,
  };
}

export async function toggleClipSave(clipId: string, userId: string) {
  const key = { clipId_userId: { clipId, userId } };
  const existing = await prisma.clipSave.findUnique({ where: key, select: { userId: true } });

  if (existing) await prisma.clipSave.delete({ where: key });
  else await prisma.clipSave.create({ data: { clipId, userId } });

  const saveCount = await prisma.clipSave.count({ where: { clipId } });
  await prisma.clip.update({ where: { id: clipId }, data: { saveCount } });
  return { saved: !existing, saveCount };
}

/** Saved clips, for the Saved page alongside saved articles. */
export async function listSavedClips(userId: string, take = 50) {
  const rows = await prisma.clipSave.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      createdAt: true,
      clip: {
        select: {
          ...CLIP_SELECT,
          isPublished: true,
          theme: { select: { slug: true, name: true, emoji: true, isActive: true } },
        },
      },
    },
  });
  return rows
    .filter((r) => r.clip && r.clip.isPublished && r.clip.theme?.isActive)
    .map((r) => ({ savedAt: r.createdAt, ...r.clip, liked: false, myReaction: null, saved: true }));
}

/**
 * One clip, on its own page, with everything the page needs around it.
 *
 * Returns null when the theme, the clip, or the link between them
 * doesn't hold — a clip id from another theme is a 404, not a
 * redirect, because the URL as typed describes something that does
 * not exist.
 *
 * The theme's other clips are fetched whole rather than as three
 * separate prev/next/related queries. A theme is tens of clips, and
 * one ordered read gives the position ("3 of 12"), both arrows, and
 * the "next up" strip from the same list — which is also the only way
 * those three can't disagree with each other.
 */
export async function getClipPage(
  themeSlug: string,
  clipId: string,
  viewerId?: string | null,
) {
  const theme = await prisma.libraryTheme.findFirst({
    where: { slug: themeSlug, isActive: true },
    select: { id: true, slug: true, name: true, emoji: true, tagline: true },
  });
  if (!theme) return null;

  const siblings = await prisma.clip.findMany({
    where: { themeId: theme.id, isPublished: true },
    // The same order the theme grid uses. If these two ever diverge,
    // "next" on the page stops meaning "the one after it" on the grid.
    orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      ...CLIP_SELECT,
      theme: { select: { slug: true, name: true, emoji: true } },
    },
  });

  const index = siblings.findIndex((c) => c.id === clipId);
  if (index === -1) return null;

  // Rotated so "next up" continues past the end of the theme instead
  // of stopping there — the reader who finishes the last clip gets the
  // first one offered, not an empty strip.
  const rotated = [...siblings.slice(index + 1), ...siblings.slice(0, index)];
  const more = rotated.slice(0, 6);

  const marks = await viewerMarks(
    [siblings[index].id, ...more.map((c) => c.id)],
    viewerId,
  );
  const withMarks = <T extends { id: string }>(c: T) => ({
    ...c,
    liked: marks.liked.has(c.id),
    myReaction: marks.liked.get(c.id) ?? null,
    saved: marks.saved.has(c.id),
  });

  const brief = (c: (typeof siblings)[number] | undefined) =>
    c ? { id: c.id, title: c.title, posterUrl: c.posterUrl } : null;

  return {
    theme,
    clip: withMarks(siblings[index]),
    // No wrap-around on the arrows. Looping is right inside a dialog
    // you opened to browse; on a page with a back button it hides the
    // fact that you reached the end.
    prev: brief(siblings[index - 1]),
    next: brief(siblings[index + 1]),
    position: index + 1,
    total: siblings.length,
    more: more.map(withMarks),
  };
}

/** Fire-and-forget view counter — never block a render on it. */
export async function recordClipView(id: string): Promise<void> {
  await prisma.clip
    .update({ where: { id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});
}
