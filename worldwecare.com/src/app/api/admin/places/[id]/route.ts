/** GET one · PATCH · DELETE. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  deletePlace,
  getAdminPlace,
  updatePlace,
  type PlaceWriteInput,
} from "@/lib/places-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const place = await getAdminPlace(id);
  if (!place) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ place });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Partial<PlaceWriteInput>;
  try {
    return NextResponse.json({ ok: true, ...(await updatePlace(id, body)) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
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
  if (auth.role === "MODERATOR") {
    return NextResponse.json(
      { error: "Moderators can't delete a place. Mark it closed instead." },
      { status: 403 },
    );
  }
  const { id } = await params;
  await deletePlace(id);
  return NextResponse.json({ ok: true });
}
