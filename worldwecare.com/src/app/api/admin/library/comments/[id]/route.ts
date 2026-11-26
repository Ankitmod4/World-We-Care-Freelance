/**
 * POST — remove or restore a comment (admin).
 *
 * Status, not deletion: a removed comment stays in the table with the
 * reason attached, so a moderation decision can be looked at again.
 * Members deleting their own comments is the path that really removes
 * a row.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { setClipCommentStatus } from "@/lib/clip-comments";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const b = (await request.json().catch(() => ({}))) as {
    action?: unknown;
    reason?: unknown;
  };
  const status =
    b.action === "remove" ? "REMOVED" : b.action === "restore" ? "PUBLISHED" : null;
  if (!status) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  try {
    return NextResponse.json({
      ok: true,
      status,
      ...(await setClipCommentStatus(
        id,
        status,
        typeof b.reason === "string" ? b.reason : null,
      )),
    });
  } catch {
    return NextResponse.json({ error: "Couldn't update that." }, { status: 400 });
  }
}
