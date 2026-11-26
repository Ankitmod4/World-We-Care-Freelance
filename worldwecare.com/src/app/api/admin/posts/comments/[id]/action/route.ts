/**
 * POST /api/admin/posts/comments/[id]/action
 *
 * Body: { action: "remove" | "restore", reason?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { removeComment, restoreComment } from "@/lib/posts-admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    reason?: string;
  };
  try {
    if (body.action === "remove") await removeComment(auth.id, id, body.reason);
    else if (body.action === "restore") await restoreComment(auth.id, id);
    else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 400 },
    );
  }
}
