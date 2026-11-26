/**
 * POST /api/user/posts/[id]/report
 *
 * Body: { reason: ReportReason, notes?: string }
 *
 * Responses:
 *   200 { ok: true, duplicate: false }  — filed
 *   200 { ok: true, duplicate: true  }  — you already filed one on this post
 *   400 { error }                       — bad reason / missing body
 *   401 { error }                       — not signed in
 *   404 { error }                       — post gone
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { isValidReason, reportPost } from "@/lib/posts-user";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id: postId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    reason?: unknown;
    notes?: unknown;
  };
  if (!isValidReason(body.reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 2000) : undefined;

  try {
    const outcome = await reportPost({
      postId,
      reporterId: auth.id,
      reason: body.reason,
      notes,
    });
    return NextResponse.json({ ok: true, duplicate: outcome.duplicate });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Report failed";
    const status = msg === "Post not found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
