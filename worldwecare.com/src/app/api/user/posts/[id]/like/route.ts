/**
 * POST /api/user/posts/[id]/like — leave, change or take back a
 * reaction. Idempotent by state; safe to double-tap.
 *
 * Body `{ type }` picks which one. Omitted means LIKE, so this stays
 * the plain like endpoint it has always been for any caller that has
 * not been updated.
 *
 * Responds with the fresh count, the resulting state and which
 * reaction is now the viewer's, so the client can reconcile if its
 * optimistic update raced.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { toggleLike } from "@/lib/posts-feed";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { type?: unknown };
  try {
    const res = await toggleLike(auth.id, id, auth.displayName, body.type);
    return NextResponse.json({ ok: true, ...res });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Like failed";
    const status = msg === "Post not found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
