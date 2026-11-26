/** GET list / POST create articles (admin). */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createArticle, listArticles, type ArticleStatusValue } from "@/lib/articles-admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const sp = request.nextUrl.searchParams;
  const status = sp.get("status") as ArticleStatusValue | "ALL" | null;
  return NextResponse.json(
    await listArticles({
      q: sp.get("q") ?? undefined,
      status: status ?? "ALL",
      categoryId: sp.get("categoryId") ?? undefined,
      page: Number(sp.get("page")) || 1,
      perPage: Number(sp.get("perPage")) || 20,
    }),
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.title !== "string" || typeof body.body !== "string") {
    return NextResponse.json({ error: "Title and body are required" }, { status: 400 });
  }
  try {
    const article = await createArticle(
      {
        title: body.title,
        body: body.body,
        excerpt: typeof body.excerpt === "string" ? body.excerpt : null,
        coverUrl: typeof body.coverUrl === "string" ? body.coverUrl : null,
        coverAlt: typeof body.coverAlt === "string" ? body.coverAlt : null,
        videoUrl: typeof body.videoUrl === "string" ? body.videoUrl : null,
        categoryId: typeof body.categoryId === "string" ? body.categoryId : null,
        status: (body.status as ArticleStatusValue) ?? "DRAFT",
        isFeatured: body.isFeatured === true,
      },
      { id: auth.id, displayName: auth.displayName },
    );
    return NextResponse.json({ ok: true, id: article.id, slug: article.slug }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed" },
      { status: 400 },
    );
  }
}
