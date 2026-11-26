/**
 * POST /api/admin/admins/[id]/status
 * body: { action: "activate" | "deactivate", reason? }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireOwner } from "@/lib/admin-auth";
import { setActive } from "@/lib/admins-admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const denied = requireOwner(auth);
  if (denied) return denied;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    reason?: string;
  };
  const action = body.action ?? "";
  if (action !== "activate" && action !== "deactivate") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  try {
    const admin = await setActive(
      auth.id,
      id,
      action === "activate",
      body.reason?.trim() || undefined,
    );
    return NextResponse.json({ item: admin });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 400 },
    );
  }
}
