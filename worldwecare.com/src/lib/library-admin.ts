/**
 * LibraryTheme — admin side.
 *
 * Themes and clips are curated, so this is plain CRUD with two pieces
 * of care:
 *
 *  • An embed URL is validated against the host whitelist BEFORE it is
 *    saved. Storing a URL that will silently render as a plain link is
 *    a confusing failure to discover later, on a page you don't own.
 *
 *  • An UPLOAD clip is only accepted once its VideoAsset is READY.
 *    A clip pointing at a still-converting asset would render a broken
 *    <video> for every reader until the encode finished.
 */

import { prisma } from "./db";
import { toEmbed, EMBED_PROVIDERS } from "./embeds";
import { slugify } from "./geography-admin";
import { discardVideo } from "./video-status";
import { deleteMediaByUrls, extractLocalImageUrls } from "./media";

export interface LibraryThemeWriteInput {
  name: string;
  tagline?: string | null;
  about?: string | null;
  coverUrl?: string | null;
  emoji?: string | null;
  isActive?: boolean;
  sortOrder?: number | null;
}

export interface ClipWriteInput {
  themeId: string;
  title: string;
  caption?: string | null;
  kind: "EMBED" | "UPLOAD";
  embedUrl?: string | null;
  /** For UPLOAD — a VideoAsset id that has finished converting. */
  videoAssetId?: string | null;
  isPublished?: boolean;
  sortOrder?: number | null;
}

/* ── slugs ───────────────────────────────────────────────────── */

async function uniqueLibraryThemeSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "theme";
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await prisma.libraryTheme.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

function clean(v: string | null | undefined, max = 500): string | null {
  const t = v?.trim();
  return t ? t.slice(0, max) : null;
}

/* ── themes ──────────────────────────────────────────────────── */

export async function listAdminLibraryThemes() {
  return prisma.libraryTheme.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      coverUrl: true,
      emoji: true,
      isActive: true,
      sortOrder: true,
      followerCount: true,
      clipCount: true,
      updatedAt: true,
    },
  });
}

export async function getAdminLibraryTheme(id: string) {
  return prisma.libraryTheme.findUnique({ where: { id } });
}

function normaliseTheme(input: LibraryThemeWriteInput) {
  const name = input.name?.trim();
  if (!name) throw new Error("Name is required");
  return {
    name: name.slice(0, 120),
    tagline: clean(input.tagline, 240),
    about: clean(input.about, 20_000),
    coverUrl: clean(input.coverUrl),
    // One or two emoji, no more — this renders in a small circle.
    emoji: clean(input.emoji, 8),
    isActive: input.isActive ?? true,
    sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0,
  };
}

export async function createLibraryTheme(input: LibraryThemeWriteInput) {
  const data = normaliseTheme(input);
  const slug = await uniqueLibraryThemeSlug(data.name);
  return prisma.libraryTheme.create({ data: { ...data, slug }, select: { id: true, slug: true } });
}

export async function updateLibraryTheme(id: string, input: Partial<LibraryThemeWriteInput>) {
  const current = await prisma.libraryTheme.findUnique({ where: { id } });
  if (!current) throw new Error("Theme not found");

  // Validate the MERGED result, not the patch — a partial update must
  // not be able to leave the row in a state a create would refuse.
  const merged = normaliseTheme({
    name: input.name ?? current.name,
    tagline: input.tagline !== undefined ? input.tagline : current.tagline,
    about: input.about !== undefined ? input.about : current.about,
    coverUrl: input.coverUrl !== undefined ? input.coverUrl : current.coverUrl,
    emoji: input.emoji !== undefined ? input.emoji : current.emoji,
    isActive: input.isActive ?? current.isActive,
    sortOrder: input.sortOrder ?? current.sortOrder,
  });

  // Renaming keeps the old slug: links people have already shared are
  // worth more than a tidy URL.
  return prisma.libraryTheme.update({ where: { id }, data: merged, select: { id: true, slug: true } });
}

export async function deleteLibraryTheme(id: string, actorId?: string) {
  const theme = await prisma.libraryTheme.findUnique({
    where: { id },
    select: { coverUrl: true, about: true },
  });
  // Read the clips BEFORE the cascade removes them — their uploaded
  // videos live outside the database and nothing else will free them.
  const clips = await prisma.clip.findMany({
    where: { themeId: id, kind: "UPLOAD" },
    select: { videoAssetId: true },
  });

  // Clips, follows, likes and saves all cascade from the schema.
  await prisma.libraryTheme.delete({ where: { id } });

  for (const clip of clips) {
    if (clip.videoAssetId) {
      await discardVideo(clip.videoAssetId, { id: actorId ?? "", isAdmin: true }).catch(() => {});
    }
  }
  await deleteMediaByUrls(
    [theme?.coverUrl, ...extractLocalImageUrls(theme?.about)],
    { allowAnyOwner: true },
  );
}

/* ── clips ───────────────────────────────────────────────────── */

export async function listAdminClips(themeId: string) {
  return prisma.clip.findMany({
    where: { themeId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      caption: true,
      kind: true,
      embedUrl: true,
      videoUrl: true,
      posterUrl: true,
      width: true,
      height: true,
      durationSec: true,
      isPublished: true,
      sortOrder: true,
      likeCount: true,
      saveCount: true,
      viewCount: true,
      commentCount: true,
      createdAt: true,
    },
  });
}

/**
 * Resolve the media half of a clip, refusing anything that would
 * render broken.
 */
async function resolveClipMedia(input: ClipWriteInput) {
  if (input.kind === "EMBED") {
    const url = clean(input.embedUrl);
    if (!url) throw new Error("Paste a video link");
    if (!toEmbed(url)) {
      throw new Error(
        `That link can't be embedded. Supported: ${EMBED_PROVIDERS}.`,
      );
    }
    return {
      kind: "EMBED" as const,
      embedUrl: url,
      videoAssetId: null,
      videoUrl: null,
      posterUrl: null,
      width: null,
      height: null,
      durationSec: null,
    };
  }

  const assetId = clean(input.videoAssetId, 60);
  if (!assetId) throw new Error("Upload a video first");
  const asset = await prisma.videoAsset.findUnique({ where: { id: assetId } });
  if (!asset) throw new Error("That upload could not be found");
  if (asset.status !== "READY" || !asset.url) {
    throw new Error("That video is still being processed — wait for it to finish.");
  }
  return {
    kind: "UPLOAD" as const,
    embedUrl: null,
    videoAssetId: asset.id,
    videoUrl: asset.url,
    posterUrl: asset.posterUrl,
    width: asset.width,
    height: asset.height,
    durationSec: asset.durationSec,
  };
}

async function refreshClipCount(themeId: string): Promise<void> {
  const clipCount = await prisma.clip.count({ where: { themeId, isPublished: true } });
  await prisma.libraryTheme.update({ where: { id: themeId }, data: { clipCount } });
}

export async function createClip(input: ClipWriteInput, adminId?: string) {
  const title = input.title?.trim();
  if (!title) throw new Error("Title is required");
  const theme = await prisma.libraryTheme.findUnique({
    where: { id: input.themeId },
    select: { id: true },
  });
  if (!theme) throw new Error("Theme not found");

  const media = await resolveClipMedia(input);
  const isPublished = input.isPublished ?? true;

  // New clips go to the top of the theme rather than the bottom — the
  // thing you just added is the thing you want to see.
  const lowest = await prisma.clip.aggregate({
    where: { themeId: input.themeId },
    _min: { sortOrder: true },
  });
  const sortOrder = Number.isFinite(input.sortOrder)
    ? Number(input.sortOrder)
    : (lowest._min.sortOrder ?? 0) - 1;

  const clip = await prisma.clip.create({
    data: {
      themeId: input.themeId,
      title: title.slice(0, 200),
      caption: clean(input.caption, 4000),
      ...media,
      isPublished,
      publishedAt: isPublished ? new Date() : null,
      sortOrder,
      addedByAdminId: adminId ?? null,
    },
    select: { id: true },
  });

  await refreshClipCount(input.themeId);
  return clip;
}

export async function updateClip(id: string, input: Partial<ClipWriteInput>) {
  const current = await prisma.clip.findUnique({ where: { id } });
  if (!current) throw new Error("Clip not found");

  const title = (input.title ?? current.title).trim();
  if (!title) throw new Error("Title is required");

  // Only touch the media fields when the caller actually changed the
  // source; re-resolving an UPLOAD on every edit would fail once the
  // VideoAsset row was pruned.
  const kind = input.kind ?? current.kind;
  const sourceChanged =
    (kind === "EMBED" && input.embedUrl !== undefined && input.embedUrl !== current.embedUrl) ||
    (kind === "UPLOAD" && input.videoAssetId !== undefined && input.videoAssetId !== current.videoAssetId) ||
    kind !== current.kind;

  const media = sourceChanged
    ? await resolveClipMedia({
        themeId: current.themeId,
        title,
        kind,
        embedUrl: input.embedUrl ?? current.embedUrl,
        videoAssetId: input.videoAssetId ?? current.videoAssetId,
      })
    : {};

  const isPublished = input.isPublished ?? current.isPublished;

  const clip = await prisma.clip.update({
    where: { id },
    data: {
      title: title.slice(0, 200),
      caption: input.caption !== undefined ? clean(input.caption, 4000) : current.caption,
      ...media,
      isPublished,
      // Keep the original publication moment when re-publishing; only
      // stamp it the first time it goes live.
      publishedAt: isPublished ? (current.publishedAt ?? new Date()) : null,
      sortOrder: input.sortOrder ?? current.sortOrder,
    },
    select: { id: true, themeId: true },
  });

  await refreshClipCount(clip.themeId);
  return clip;
}

export async function deleteClip(id: string, actorId?: string) {
  const clip = await prisma.clip.findUnique({
    where: { id },
    select: { themeId: true, kind: true, videoAssetId: true },
  });
  await prisma.clip.delete({ where: { id } });
  if (!clip) return;
  await refreshClipCount(clip.themeId);
  // An uploaded clip is the only kind that costs storage; an embed is
  // someone else's bytes.
  if (clip.kind === "UPLOAD" && clip.videoAssetId) {
    await discardVideo(clip.videoAssetId, { id: actorId ?? "", isAdmin: true }).catch(() => {});
  }
}

/** Persist a drag-reorder in one transaction. */
export async function reorderClips(themeId: string, orderedIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.clip.updateMany({ where: { id, themeId }, data: { sortOrder: index } }),
    ),
  );
}

export async function reorderLibraryThemes(orderedIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.libraryTheme.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
}
