/**
 * POST /api/user/upload
 *
 * multipart/form-data: { file: File }
 * Response: { ok, url } | { ok: false, error }
 *
 * Signed-in users only. Images land under the "posts" category
 * (public/uploads/posts/...). Type + size validation lives in
 * uploadFile() and is driven by the admin storage settings, so the
 * user and admin upload paths stay consistent.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { uploadFile } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
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
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await uploadFile(buf, file.name, file.type, "posts", {
    id: auth.id,
    kind: "USER",
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, url: result.url });
}
