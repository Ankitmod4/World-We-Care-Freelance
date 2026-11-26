/**
 * POST /api/admin/admins/[id]/reset-password
 *
 * body: { password?: string }
 *   - If password is supplied, it becomes the new password.
 *   - If omitted, we generate a random one.
 *
 * Returns { newPassword } EXACTLY ONCE. The plaintext is never
 * stored, never re-fetchable — the calling admin has to copy it now.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireOwner } from "@/lib/admin-auth";
import { resetAdminPassword, suggestPassword } from "@/lib/admins-admin";

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
    password?: string;
  };
  const supplied = (body.password ?? "").trim();
  const newPassword = supplied || suggestPassword();
  try {
    await resetAdminPassword(auth.id, id, newPassword);
    return NextResponse.json({ ok: true, newPassword });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reset failed" },
      { status: 400 },
    );
  }
}
