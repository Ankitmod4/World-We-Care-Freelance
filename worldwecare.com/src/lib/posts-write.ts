/**
 * User-side post creation.
 *
 * Freezes the author's display name + avatar into the post row
 * (authorNameSnapshot / authorAvatarSnapshot) so the feed doesn't
 * turn into "Deleted user" for content that was fine when it was
 * posted. This matches the pattern already used by the admin
 * moderation surface.
 *
 * Body limits are enforced here so the API route is a thin
 * wrapper. A post may carry text, images, or both — an image-only
 * post (empty caption) is allowed; a truly empty post is not.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { createForAllAdmins } from "./admin-notifications";
import { discardVideo } from "./video-status";
import { deleteMediaByUrls, extractLocalImageUrls } from "./media";
import {
  attachedAssetId,
  attachedImageUrls,
  resolveAttachedVideo,
  sanitiseImages,
  type AttachedVideo,
} from "./attached-media";

export interface CreatePostInput {
  authorId: string;
  body: string;
  isAnonymous?: boolean;
  images?: Array<{ url: string; alt?: string | null }>;
  /**
   * Id of a VideoAsset this author uploaded. The URL is resolved
   * server-side — see `resolveVideo`.
   */
  videoAssetId?: string | null;
  countryId?: string | null;
}

/** Kept as a name here because callers import it; one definition. */
export type PostVideo = AttachedVideo;

export const BODY_MIN = 1;
export const BODY_MAX = 5000;
export const MAX_IMAGES = 6;

export interface CreatePostOutcome {
  id: string;
}

export async function createPost(input: CreatePostInput): Promise<CreatePostOutcome> {
  const body = input.body.trim();
  if (body.length > BODY_MAX) {
    throw new Error(`Post is too long (${body.length}/${BODY_MAX}).`);
  }

  const images = sanitiseImages(input.images, MAX_IMAGES);

  const video = await resolveAttachedVideo(input.videoAssetId, input.authorId);

  // A post needs at least a caption, an image, or a video.
  if (body.length < BODY_MIN && images.length === 0 && !video) {
    throw new Error("Post can't be empty.");
  }

  const author = await prisma.user.findUnique({
    where: { id: input.authorId },
    select: {
      displayName: true,
      avatarUrl: true,
      isActive: true,
      bannedAt: true,
    },
  });
  if (!author) throw new Error("User not found");
  if (!author.isActive) throw new Error("Account is deactivated.");
  if (author.bannedAt) throw new Error("Account is banned.");

  const row = await prisma.post.create({
    data: {
      authorId: input.authorId,
      authorNameSnapshot: author.displayName,
      authorAvatarSnapshot: author.avatarUrl ?? null,
      body,
      isAnonymous: input.isAnonymous ?? false,
      // Prisma's InputJsonValue wants an index signature; these are
      // closed shapes on purpose, so cast at the boundary rather than
      // loosening the types everywhere they are read.
      images:
        images.length > 0
          ? (images as unknown as Prisma.InputJsonValue)
          : undefined,
      video: video ? (video as unknown as Prisma.InputJsonObject) : undefined,
      countryId: input.countryId ?? null,
    },
  });

  // Best-effort admin ping — quiet by default, but if we later
  // want to route certain keywords to a mod inbox this is the hook.
  // For now we do NOT notify admins on every post; that would
  // drown out the report notifications. Just log it lightly.
  // Left as a placeholder call for future spam-detection wiring.
  void createForAllAdmins; // (intentionally not called on normal posts)

  return { id: row.id };
}

/**
 * Author-initiated hard delete. Verifies ownership first, then
 * removes the post — PostComment / PostLike / PostSave / PostReport
 * all cascade on the Post relation, so the row goes cleanly.
 *
 * Throws "Not your post" (→ 403) if the caller isn't the author, so
 * a guessed id can never delete someone else's content.
 */
export async function deletePost(userId: string, postId: string): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true, images: true, video: true, body: true },
  });
  if (!post) throw new Error("Post not found");
  if (post.authorId !== userId) throw new Error("Not your post");
  await prisma.post.delete({ where: { id: postId } });

  // Take the media with it, scoped to this user. The image URLs came
  // from the client, so `deleteMediaByUrls` checks each one against an
  // UploadedFile row owned by them — a post naming someone else's file
  // deletes nothing.
  await deleteMediaByUrls(
    [...postImageUrls(post.images), ...extractLocalImageUrls(post.body)],
    { ownerId: userId },
  );

  // `discardVideo` re-checks ownership itself, so a hand-edited
  // `video` blob naming someone else's asset deletes nothing either.
  const assetId = attachedAssetId(post.video);
  if (assetId) {
    await discardVideo(assetId, { id: userId, isAdmin: false }).catch(() => {});
  }
}

/** The `url` of each entry in a post's `images` JSON, defensively. */
export const postImageUrls = attachedImageUrls;
