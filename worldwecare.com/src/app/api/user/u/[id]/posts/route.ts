/** GET a member's public (non-anonymous) posts. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listFeed } from "@/lib/posts-feed";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const sp = new URL(request.url).searchParams;
  const page = await listFeed({
    viewerId: auth.id,
    authorId: id,
    excludeAnonymous: true,
    cursor: sp.get("cursor"),
    limit: sp.get("limit") ? Number.parseInt(sp.get("limit")!, 10) : undefined,
  });
  return NextResponse.json(page);
}
