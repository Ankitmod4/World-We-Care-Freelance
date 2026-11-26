/**
 * POST /api/admin/upload
 *
 * multipart/form-data:
 *   file      — File
 *   category  — string (e.g. "logos", "favicons", "avatars")
 *
 * Response: { ok, url } | { ok: false, error }
 *
 * Only admins can upload here — the frontend has its own upload
 * flow (with tighter validation) at /api/user/upload later.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { uploadFile } from "@/lib/upload";

// Uploads are Node-runtime by necessity — node:fs isn't available in
// edge. Also don't cache — every upload is a distinct write.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Request must be multipart/form-data" },
      { status: 400 },
    );
  }
  const file = form.get("file");
  const categoryRaw = form.get("category");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  const category = typeof categoryRaw === "string" ? categoryRaw : "misc";
  const buf = Buffer.from(await file.arrayBuffer());
  const result = await uploadFile(buf, file.name, file.type, category, {
    id: auth.id,
    kind: "ADMIN",
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, url: result.url });
}
