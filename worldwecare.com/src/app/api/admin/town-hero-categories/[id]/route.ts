/** PATCH /api/admin/town-hero-categories/[id]. DELETE — only when unused. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { updateHeroCategory, deleteHeroCategory } from "@/lib/town-hero-categories";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await updateHeroCategory(id, {
      name: typeof b.name === "string" ? b.name : undefined,
      description: typeof b.description === "string" ? b.description : undefined,
      emoji: typeof b.emoji === "string" ? b.emoji : undefined,
      color: typeof b.color === "string" ? b.color : undefined,
      sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : undefined,
      isActive: typeof b.isActive === "boolean" ? b.isActive : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await deleteHeroCategory(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // "In use" is the expected answer here, not a server fault — the
    // message tells the admin to retire it instead.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 400 },
    );
  }
}
