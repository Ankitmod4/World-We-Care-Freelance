/**
 * POST /api/admin/users/[id]/status
 *
 * Handles the four moderation state transitions on one endpoint so
 * the client only needs to know one URL:
 *
 *   body: { action: "activate" | "deactivate" | "ban" | "unban", reason? }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  banUserAdmin,
  setActiveAdmin,
  unbanUserAdmin,
} from "@/lib/users-admin";

const ACTIONS = new Set(["activate", "deactivate", "ban", "unban"] as const);

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
  const action = body.action ?? "";
  if (!ACTIONS.has(action as "activate" | "deactivate" | "ban" | "unban")) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  const reason = (body.reason ?? "").trim() || undefined;

  try {
    if (action === "ban") {
      if (!reason) {
        return NextResponse.json(
          { error: "A reason is required to ban an account." },
          { status: 400 },
        );
      }
      const user = await banUserAdmin(auth.id, id, reason);
      return NextResponse.json({ item: user });
    }
    if (action === "unban") {
      const user = await unbanUserAdmin(auth.id, id, reason);
      return NextResponse.json({ item: user });
    }
    const user = await setActiveAdmin(
      auth.id,
      id,
      action === "activate",
      reason,
    );
    return NextResponse.json({ item: user });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 400 },
    );
  }
}
