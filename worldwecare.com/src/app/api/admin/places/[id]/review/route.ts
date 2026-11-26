/** POST — approve or reject a submitted place. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { reviewPlace } from "@/lib/places-admin";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; note?: unknown };
  const action = body.action === "approve" ? "approve" : body.action === "reject" ? "reject" : null;
  if (!action) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  try {
    return NextResponse.json(
      await reviewPlace(id, auth.id, action, typeof body.note === "string" ? body.note : undefined),
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Review failed" },
      { status: 400 },
    );
  }
}
