/**
 * POST /api/user/upload/video
 *
 * Raw body upload (not multipart) with `x-filename`. Returns the id of
 * a VideoAsset that is now converting; poll the [id] route for status.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser, getCurrentUser } from "@/lib/user-auth";
import { receiveVideoUpload } from "@/lib/video-upload";
import { getGroup } from "@/lib/settings";
import { normaliseLimits } from "@/lib/upload-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 900;

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  // Same bar as submitting an event: an unverified account should not
  // be able to spend the server's CPU on transcoding.
  const viewer = await getCurrentUser();
  if (!viewer?.emailVerifiedAt) {
    return NextResponse.json(
      { error: "Verify your email address before uploading video." },
      { status: 403 },
    );
  }

  const result = await receiveVideoUpload(request, { id: auth.id, kind: "USER" }, "clips");
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
  const auth = await requireUser(request);
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
