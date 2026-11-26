/** GET — the place-report queue. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listPlaceReports } from "@/lib/place-reports";

export const dynamic = "force-dynamic";

const STATUSES = ["OPEN", "RESOLVED", "DISMISSED", "ALL"] as const;
type Status = (typeof STATUSES)[number];

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const raw = request.nextUrl.searchParams.get("status");
  const status = (STATUSES as readonly string[]).includes(raw ?? "")
    ? (raw as Status)
    : "OPEN";

  return NextResponse.json(await listPlaceReports({ status }));
}
