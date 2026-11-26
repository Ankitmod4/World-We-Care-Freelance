/** GET list / POST create live-stream categories. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createCategory, listCategories } from "@/lib/live-categories";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ categories: await listCategories() });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof b.name !== "string" || !b.name.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  try {
    const cat = await createCategory({
      name: b.name,
      description: typeof b.description === "string" ? b.description : null,
      emoji: typeof b.emoji === "string" ? b.emoji : null,
      color: typeof b.color === "string" ? b.color : null,
      sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : undefined,
      isActive: typeof b.isActive === "boolean" ? b.isActive : undefined,
    });
    return NextResponse.json({ ok: true, id: cat.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed" },
      { status: 400 },
    );
  }
}
