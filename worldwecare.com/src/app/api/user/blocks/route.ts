/** GET /api/user/blocks — the viewer's blocked accounts. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listBlocked } from "@/lib/blocks";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ blocked: await listBlocked(auth.id) });
}
