/** GET one / PATCH update / DELETE an article (admin). */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  deleteArticle,
  getArticle,
  updateArticle,
  type ArticleStatusValue,
} from "@/lib/articles-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const article = await getArticle(id);
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ article });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // Only forward keys the client actually sent, so a PATCH never
  // blanks a field it didn't mention.
  const patch: Record<string, unknown> = {};
  for (const key of ["title", "body", "excerpt", "coverUrl", "coverAlt", "videoUrl", "categoryId"]) {
    if (key in body) patch[key] = body[key];
  }
  if ("status" in body) patch.status = body.status as ArticleStatusValue;
  if ("isFeatured" in body) patch.isFeatured = body.isFeatured === true;

  try {
    await updateArticle(id, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: msg === "Article not found" ? 404 : 400 });
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
    await deleteArticle(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 400 });
  }
}
