/** PATCH rename / DELETE an article category (admin). */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { deleteArticleCategory, updateArticleCategory } from "@/lib/articles-admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await updateArticleCategory(id, {
      name: typeof body.name === "string" ? body.name : undefined,
      description: "description" in body ? (body.description as string | null) : undefined,
      emoji: "emoji" in body ? (body.emoji as string | null) : undefined,
      color: "color" in body ? (body.color as string | null) : undefined,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
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
    // Articles in this category survive — categoryId is SetNull.
    await deleteArticleCategory(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 400 });
  }
}
