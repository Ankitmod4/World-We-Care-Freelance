/**
 * POST /api/admin/posts/[id]/action
 *
 * Body: { action: "remove" | "restore" | "feature" | "unfeature", reason?: string }
 *
 * Kept as one endpoint so the client only has to hit one URL for
 * every kind of moderation on a post — the audit log entry that
 * comes out the other side already carries the specific action.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { removePost, restorePost, setPostFeatured } from "@/lib/posts-admin";

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
    switch (body.action) {
      case "remove":
        await removePost(auth.id, id, body.reason);
        break;
      case "restore":
        await restorePost(auth.id, id);
        break;
      case "feature":
        await setPostFeatured(auth.id, id, true);
        break;
      case "unfeature":
        await setPostFeatured(auth.id, id, false);
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 400 },
    );
  }
}
