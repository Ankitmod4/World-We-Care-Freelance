/** GET /api/admin/town-hero-categories — list. POST — create. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listHeroCategoriesAdmin, createHeroCategory } from "@/lib/town-hero-categories";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ categories: await listHeroCategoriesAdmin() });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const created = await createHeroCategory({
      name: typeof b.name === "string" ? b.name : "",
      description: typeof b.description === "string" ? b.description : null,
      emoji: typeof b.emoji === "string" ? b.emoji : null,
      color: typeof b.color === "string" ? b.color : null,
      sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : 0,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 400 },
    );
  }
}
