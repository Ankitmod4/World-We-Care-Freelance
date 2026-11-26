/**
 * GET /api/admin/posts — paginated list with search + status filter
 * (all / published / pending / removed / reported).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listPosts, type PostStatusFilter } from "@/lib/posts-admin";

const STATUSES = new Set<PostStatusFilter>([
  "all",
  "published",
  "pending",
  "removed",
  "reported",
]);

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const params = new URL(request.url).searchParams;
  const q = params.get("q") ?? "";
  const statusRaw = (params.get("status") ?? "all") as PostStatusFilter;
  const status = STATUSES.has(statusRaw) ? statusRaw : "all";
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  const perPage = Number.parseInt(params.get("perPage") ?? "25", 10);
  const authorId = params.get("authorId") ?? undefined;
  const countryId = params.get("countryId") ?? undefined;
  const onlyFeatured = params.get("featured") === "1";

  const result = await listPosts({
    q,
    status,
    page,
    perPage,
    authorId,
    countryId,
    onlyFeatured,
  });
  return NextResponse.json(result);
}
