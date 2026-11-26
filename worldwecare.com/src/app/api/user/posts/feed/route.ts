/**
 * GET /api/user/posts/feed
 *
 * Cursor-paginated feed. Anonymous readers get the same feed but
 * with liked/saved always false (no viewer state to join). Signed-
 * in readers see their own like/save state joined per row.
 *
 * Query params:
 *   ?cursor=<opaque>   — page cursor from a previous response
 *   ?limit=20          — 5-50, default 20
 *   ?countryId=<id>    — restrict to a country
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";
import { listFeed } from "@/lib/posts-feed";
import { getBlockedIds } from "@/lib/blocks";

export async function GET(request: NextRequest) {
  const viewer = await getCurrentUser();
  const params = new URL(request.url).searchParams;
  const cursor = params.get("cursor") ?? undefined;
  const limitRaw = params.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  const countryId = params.get("countryId") ?? undefined;

  const blockedIds = viewer ? await getBlockedIds(viewer.id) : [];
  const page = await listFeed({
    viewerId: viewer?.id ?? null,
    cursor: cursor || null,
    limit,
    countryId,
    blockedIds,
  });
  return NextResponse.json(page);
}
