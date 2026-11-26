/** GET conversion status · DELETE discards the asset. Any admin. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { discardVideo, readVideoStatus } from "@/lib/video-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const status = await readVideoStatus(id, { id: auth.id, isAdmin: true });
  if (!status) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(status);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const ok = await discardVideo(id, { id: auth.id, isAdmin: true });
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
