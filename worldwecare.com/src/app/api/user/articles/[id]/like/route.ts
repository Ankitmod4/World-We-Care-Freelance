/**
 * POST /api/user/articles/[id]/like — toggle a like. Idempotent by
 * state; returns the fresh count so an optimistic client can
 * reconcile if it raced.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { toggleArticleLike } from "@/lib/articles";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { type?: unknown };
  try {
    return NextResponse.json({ ok: true, ...(await toggleArticleLike(id, auth.id, body.type)) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Like failed" },
      { status: 400 },
    );
  }
}
