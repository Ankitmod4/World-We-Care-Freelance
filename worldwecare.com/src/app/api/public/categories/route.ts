/**
 * GET /api/public/categories?kind=gratitude
 *
 * The active categories, for the composer's picker and the filter row.
 * Public and cacheable: they change rarely and every page load wants
 * them. Retired categories are absent — a post already filed under one
 * keeps it, but nobody is offered it again.
 */

import { NextRequest, NextResponse } from "next/server";
import { listPublicCategories, type CategoryKind } from "@/lib/post-categories";

const KINDS: CategoryKind[] = ["gratitude"];

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("kind");
  const kind = KINDS.find((k) => k === raw);
  if (!kind) {
    return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  }
  return NextResponse.json(
    { categories: await listPublicCategories(kind) },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
