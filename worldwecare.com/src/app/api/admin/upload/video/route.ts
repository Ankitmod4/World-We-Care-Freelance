/** POST /api/admin/upload/video — same contract as the member route. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { receiveVideoUpload } from "@/lib/video-upload";
import { getGroup } from "@/lib/settings";
import { normaliseLimits } from "@/lib/upload-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 900;

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const category = request.nextUrl.searchParams.get("category") ?? "clips";
  const result = await receiveVideoUpload(request, { id: auth.id, kind: "ADMIN" }, category);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }
  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}

/**
 * GET — the current limits, so the uploader can show the real numbers
 * and refuse an oversized file before spending the bandwidth.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const group = await getGroup("storage");
  const limits = normaliseLimits({
    maxVideoMB: group["storage.maxVideoMB"],
    maxVideoSeconds: group["storage.maxVideoSeconds"],
    maxFileMB: group["storage.maxFileMB"],
  });
  return NextResponse.json({
    maxMB: limits.maxVideoMB,
    maxSeconds: limits.maxVideoSeconds,
  });
}
