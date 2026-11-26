/** GET one / DELETE a petition (admin). */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { deletePetition, getAdminPetition } from "@/lib/petitions-admin";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const petition = await getAdminPetition(id);
  if (!petition) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ petition });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await deletePetition(id);
  return NextResponse.json({ ok: true });
}
