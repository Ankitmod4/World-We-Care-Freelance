/**
 * GET /api/user/profile/posts — the signed-in user's own posts.
 * Reuses listFeed with an authorId filter so profile cards render
 * identically to the home feed.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listFeed } from "@/lib/posts-feed";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const sp = new URL(request.url).searchParams;
  const cursor = sp.get("cursor") ?? undefined;
  const limitRaw = sp.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

  const page = await listFeed({
    viewerId: auth.id,
    authorId: auth.id,
    cursor: cursor || null,
    limit,
  });
  return NextResponse.json(page);
}
