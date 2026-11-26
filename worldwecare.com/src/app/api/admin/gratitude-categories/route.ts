/** GET list / POST create gratitude categories (admin). */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createCategory, listCategories } from "@/lib/post-categories";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ categories: await listCategories("gratitude") });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const cat = await createCategory("gratitude", {
      name: typeof b.name === "string" ? b.name : "",
      description: typeof b.description === "string" ? b.description : null,
      emoji: typeof b.emoji === "string" ? b.emoji : null,
      sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : undefined,
    });
    return NextResponse.json({ ok: true, ...cat }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed" },
      { status: 400 },
    );
  }
}
