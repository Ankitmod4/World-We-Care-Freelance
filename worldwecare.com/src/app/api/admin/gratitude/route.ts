/** GET /api/admin/gratitude?status=PENDING|APPROVED|REJECTED|ALL — moderation list. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listGratitudeAdmin, countPendingGratitude } from "@/lib/gratitude";
import type { GratitudeStatus } from "@prisma/client";

const VALID = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("status") || "PENDING").toUpperCase();
  const status = (VALID as readonly string[]).includes(raw) ? (raw as GratitudeStatus | "ALL") : "PENDING";
  const cursor = searchParams.get("cursor");
  const [page, pendingCount] = await Promise.all([
    listGratitudeAdmin({ status, cursor }),
    countPendingGratitude(),
  ]);
  return NextResponse.json({ ...page, pendingCount });
}
