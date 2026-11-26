/** PATCH update / DELETE an event category. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { deleteCategory, updateCategory } from "@/lib/event-categories";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await updateCategory(id, {
      name: typeof b.name === "string" ? b.name : undefined,
      // `undefined` means "leave it"; an explicit null clears it. The
      // distinction matters for the optional emoji and colour fields.
      description: b.description === undefined ? undefined : (b.description as string | null),
      emoji: b.emoji === undefined ? undefined : (b.emoji as string | null),
      color: b.color === undefined ? undefined : (b.color as string | null),
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
    await deleteCategory(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 400 },
    );
  }
}
