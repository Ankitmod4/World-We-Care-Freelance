/**
 * GET  /api/admin/admins/[id] — single admin
 * PUT  /api/admin/admins/[id] — update displayName / email / role
 * DELETE /api/admin/admins/[id] — hard delete (guarded)
 */

import { AdminRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireOwner } from "@/lib/admin-auth";
import { deleteAdmin, getAdmin, updateAdmin } from "@/lib/admins-admin";

const ROLES = new Set<string>(Object.values(AdminRole));

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const admin = await getAdmin(id);
  if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: admin });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    displayName?: string;
    email?: string;
    role?: string;
  };

  // Editing somebody else is owner business. Editing your own name or
  // email is not — but changing a ROLE is, including your own, which
  // is the whole escalation this closes.
  if (auth.id !== id || body.role !== undefined) {
    const denied = requireOwner(auth);
    if (denied) return denied;
  }

  try {
    const admin = await updateAdmin(auth.id, id, {
      displayName: body.displayName,
      email: body.email,
      role:
        body.role && ROLES.has(body.role) ? (body.role as AdminRole) : undefined,
    });
    return NextResponse.json({ item: admin });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const denied = requireOwner(auth);
  if (denied) return denied;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  try {
    await deleteAdmin(auth.id, id, body.reason);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 400 },
    );
  }
}
