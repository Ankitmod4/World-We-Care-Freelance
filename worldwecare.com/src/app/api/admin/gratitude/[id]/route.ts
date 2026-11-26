/** POST /api/admin/gratitude/[id] — { action: "approve"|"reject", reason? }. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { moderateGratitude } from "@/lib/gratitude";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as { action?: unknown; reason?: unknown };
  if (b.action !== "approve" && b.action !== "reject") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  try {
    const item = await moderateGratitude(
      auth.id,
      id,
      b.action,
      typeof b.reason === "string" ? b.reason : undefined,
    );
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
