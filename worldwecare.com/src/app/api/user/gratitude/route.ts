/** GET /api/user/gratitude — feed (cursor). POST — create entry. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listGratitude, createGratitude } from "@/lib/gratitude";
import { getBlockedIds } from "@/lib/blocks";
import { categoryIdForSlug, validCategoryId } from "@/lib/post-categories";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(request.url);
  const blockedIds = await getBlockedIds(auth.id);
  // ?category=<slug>, so the category page's "Show more" asks for the
  // same thing its URL says. An unknown slug means no filter rather
  // than an error — a stale link should show everything, not a dead
  // end. Same shape as the confessions route.
  const categoryId = await categoryIdForSlug("gratitude", searchParams.get("category"));

  const page = await listGratitude({
    viewerId: auth.id,
    cursor: searchParams.get("cursor"),
    blockedIds,
    categoryId,
  });
  return NextResponse.json(page);
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const b = (await request.json().catch(() => ({}))) as { body?: unknown; isAnonymous?: unknown; imageUrl?: unknown; videoAssetId?: unknown; categoryId?: unknown };
  try {
    const item = await createGratitude(auth.id, {
      body: typeof b.body === "string" ? b.body : "",
      imageUrl: typeof b.imageUrl === "string" ? b.imageUrl : null,
      // AN ID, NEVER A URL. Anything else is dropped rather than
      // coerced — see `resolveAttachedVideo`.
      videoAssetId: typeof b.videoAssetId === "string" ? b.videoAssetId : null,
      isAnonymous: b.isAnonymous === true,
      authorName: auth.displayName,
      authorAvatar: auth.avatarUrl,
      // Unknown or retired category ids become null, not an error.
      categoryId: await validCategoryId("gratitude", b.categoryId),
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
