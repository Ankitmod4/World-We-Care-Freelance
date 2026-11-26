/** GET — every broadcast, live first. The moderation list. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listAdminStreams } from "@/lib/live-streams";

export const dynamic = "force-dynamic";

const STATUSES = ["IDLE", "LIVE", "ENDED"] as const;
type Status = (typeof STATUSES)[number];

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const sp = request.nextUrl.searchParams;
  const raw = sp.get("status");
  return NextResponse.json({
    streams: await listAdminStreams({
      status: STATUSES.includes(raw as Status) ? (raw as Status) : undefined,
      q: sp.get("q") ?? undefined,
    }),
  });
}
