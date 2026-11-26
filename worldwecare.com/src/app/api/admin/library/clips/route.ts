/** POST — add a clip to a theme. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClip, type ClipWriteInput } from "@/lib/library-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => ({}))) as ClipWriteInput;
  try {
    const clip = await createClip(body, auth.id);
    return NextResponse.json({ ok: true, ...clip }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not add the clip" },
      { status: 400 },
    );
  }
}
