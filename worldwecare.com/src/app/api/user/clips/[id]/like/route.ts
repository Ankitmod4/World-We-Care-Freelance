/** POST — toggle the viewer's like on a clip. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { toggleClipLike } from "@/lib/library";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { type?: unknown };
  try {
    return NextResponse.json(await toggleClipLike(id, auth.id, body.type));
  } catch {
    return NextResponse.json({ error: "Could not update" }, { status: 400 });
  }
}
