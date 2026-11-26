/** PATCH / DELETE one gratitude category (admin). */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { deleteCategory, updateCategory } from "@/lib/post-categories";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await updateCategory("gratitude", id, {
      name: typeof b.name === "string" ? b.name : undefined,
      description: "description" in b ? (b.description as string | null) : undefined,
      emoji: "emoji" in b ? (b.emoji as string | null) : undefined,
      sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : undefined,
      isActive: typeof b.isActive === "boolean" ? b.isActive : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    // Entries under it survive and become uncategorised — the
    // relation is SetNull. The count comes back so the UI can say how
    // many that was.
    return NextResponse.json({ ok: true, ...(await deleteCategory("gratitude", id)) });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 400 });
  }
}
