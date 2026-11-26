/**
 * GET  /api/admin/users/[id] — full user row
 * PUT  /api/admin/users/[id] — partial update (displayName, email,
 *                              avatarUrl, anonymousByDefault)
 * DELETE /api/admin/users/[id] — hard delete (permanent)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  deleteUserAdmin,
  getUserAdmin,
  updateUserAdmin,
} from "@/lib/users-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const user = await getUserAdmin(id);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item: user });
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
    avatarUrl?: string | null;
    anonymousByDefault?: boolean;
  };
  try {
    const user = await updateUserAdmin(auth.id, id, body);
    return NextResponse.json({ item: user });
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
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  await deleteUserAdmin(auth.id, id, body.reason);
  return NextResponse.json({ ok: true });
}
