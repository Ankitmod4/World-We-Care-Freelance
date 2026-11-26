/**
 * POST /api/admin/posts/reports/[id]
 *
 * Body: { outcome: "remove" | "keep" | "dismiss", note?: string }
 *
 * "remove"  — hide the target and mark resolved
 * "keep"    — leave the target live, mark resolved
 * "dismiss" — mark dismissed (bad-faith report)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveReport } from "@/lib/posts-admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    outcome?: string;
    note?: string;
  };
  if (body.outcome !== "remove" && body.outcome !== "keep" && body.outcome !== "dismiss") {
    return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
  }
  try {
    await resolveReport(auth.id, id, body.outcome, body.note);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 400 },
    );
  }
}
