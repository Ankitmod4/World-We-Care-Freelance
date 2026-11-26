/**
 * POST /api/user/posts — create a post from the signed-in user.
 *
 * Body: { body: string, isAnonymous?: boolean, images?: [{url, alt?}],
 *         videoAssetId?: string, countryId?: string }
 *
 * Note `videoAssetId`, not a video URL — createPost resolves it from
 * the uploader's own VideoAsset row so a post can't be pointed at an
 * arbitrary file.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { createPost } from "@/lib/posts-write";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    body?: unknown;
    isAnonymous?: unknown;
    images?: unknown;
    videoAssetId?: unknown;
    countryId?: unknown;
  };

  if (typeof body.body !== "string") {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }

  const images = Array.isArray(body.images)
    ? (body.images.filter(
        (i): i is { url: string; alt?: string | null } =>
          i !== null &&
          typeof i === "object" &&
          "url" in i &&
          typeof (i as { url: unknown }).url === "string",
      ))
    : undefined;

  try {
    const result = await createPost({
      authorId: auth.id,
      body: body.body,
      isAnonymous: body.isAnonymous === true,
      images,
      videoAssetId: typeof body.videoAssetId === "string" ? body.videoAssetId : null,
      countryId: typeof body.countryId === "string" ? body.countryId : null,
    });
    return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Post failed" },
      { status: 400 },
    );
  }
}
