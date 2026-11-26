/**
 * GET /api/admin/posts/stats — overview counters for the posts hub.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getPostStats } from "@/lib/posts-admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(await getPostStats());
}
