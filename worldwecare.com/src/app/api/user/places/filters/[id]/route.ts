/** DELETE — remove one saved filter set. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { deleteFilterSet } from "@/lib/places";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  // Scoped to this user inside deleteFilterSet, so someone else's id
  // is a no-op rather than a 403 that confirms it exists.
  await deleteFilterSet(auth.id, id);
  return NextResponse.json({ ok: true });
}
