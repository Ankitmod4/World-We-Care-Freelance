/**
 * GET  — full ffmpeg readiness report.
 * DELETE — forget a managed install so detection falls back to PATH.
 *
 * The probe spawns processes and runs a one-second test encode, so it
 * must run on the Node runtime and must never be cached.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { forgetManagedFfmpeg, isInstalling, probeFfmpeg } from "@/lib/ffmpeg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const status = await probeFfmpeg();
  return NextResponse.json({ ...status, installing: isInstalling() });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "OWNER") {
    return NextResponse.json({ error: "Only an owner can change the ffmpeg install." }, { status: 403 });
  }
  await forgetManagedFfmpeg();
  return NextResponse.json({ ok: true });
}
