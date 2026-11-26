/**
 * GET /api/admin/posts/reports/count — how many reports are OPEN
 * right now. Polled by the sidebar badge; kept as its own tiny
 * endpoint so it's a single indexed COUNT and doesn't drag any
 * heavier stats along.
 *
 * Cache header is `no-store` because the whole point of the badge
 * is that it reflects the truth within the poll interval.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { ReportStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const openCount = await prisma.postReport.count({
    where: { status: ReportStatus.OPEN },
  });
  return NextResponse.json(
    { openCount },
    { headers: { "Cache-Control": "no-store" } },
  );
}
