/**
 * GET /api/user/saved — the signed-in user's bookmarked posts.
 * Same { items, nextCursor } shape as the feed so the client list
 * component is reusable.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listSaved } from "@/lib/posts-feed";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const sp = new URL(request.url).searchParams;
  const cursor = sp.get("cursor") ?? undefined;
  const limitRaw = sp.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

  const page = await listSaved({ viewerId: auth.id, cursor: cursor || null, limit });
  return NextResponse.json(page);
}
