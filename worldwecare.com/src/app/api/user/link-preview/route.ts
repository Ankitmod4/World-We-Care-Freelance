/** GET /api/user/link-preview?url=... — Open-Graph preview for a URL. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { fetchLinkPreview } from "@/lib/link-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const url = new URL(request.url).searchParams.get("url");
  if (!url) return NextResponse.json({ preview: null });
  const preview = await fetchLinkPreview(url);
  return NextResponse.json({ preview });
}
