/** POST — toggle the viewer's save on a place. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { togglePlaceSave } from "@/lib/places";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    return NextResponse.json(await togglePlaceSave(id, auth.id));
  } catch {
    return NextResponse.json({ error: "Could not update" }, { status: 400 });
  }
}
