/**
 * POST — download and install a static ffmpeg build.
 *
 * OWNER only. This writes an executable to disk and then runs it, so
 * it is the most privileged thing the admin panel can do; a moderator
 * or ordinary admin has no business triggering it.
 *
 * The URL, if supplied, is still checked against the host allowlist
 * inside `installStaticFfmpeg` — passing one here does not widen what
 * can be fetched.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { installStaticFfmpeg, isInstalling } from "@/lib/ffmpeg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Downloading ~80 MB and unpacking it comfortably outruns the default.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "OWNER") {
    return NextResponse.json(
      { ok: false, message: "Only an owner can install ffmpeg." },
      { status: 403 },
    );
  }
  if (isInstalling()) {
    return NextResponse.json(
      { ok: false, message: "An install is already running. Give it a moment." },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    url?: string;
    expectedSha256?: string;
  };

  const result = await installStaticFfmpeg({
    url: body.url,
    expectedSha256: body.expectedSha256,
  });

  // Not written to AdminActionLog: its `AdminAction` enum has no value
  // for a settings change, and adding one would force a migration for a
  // single log line. The server log is enough to answer "who ran this".
  console.info(
    `[ffmpeg] install by ${auth.email} — ${result.ok ? "ok" : "failed"}: ${result.message}` +
      (result.sha256 ? ` (sha256 ${result.sha256})` : ""),
  );

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
