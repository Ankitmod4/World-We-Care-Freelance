/**
 * GET /api/admin/posts/reports — paginated report queue.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listReports, type ReportStatusFilter } from "@/lib/posts-admin";

const STATUSES = new Set<ReportStatusFilter>(["all", "open", "resolved", "dismissed"]);

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  const statusRaw = (params.get("status") ?? "open") as ReportStatusFilter;
  const status = STATUSES.has(statusRaw) ? statusRaw : "open";
  const reason = params.get("reason") ?? undefined;
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  const perPage = Number.parseInt(params.get("perPage") ?? "25", 10);
  const result = await listReports({ status, reason, page, perPage });
  return NextResponse.json(result);
}
