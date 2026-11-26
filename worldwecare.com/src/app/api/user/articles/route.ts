/** GET /api/user/articles — the public magazine feed (published only). */
import { NextRequest, NextResponse } from "next/server";
import { listPublishedArticles, listReaderCategories } from "@/lib/articles";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const [feed, categories] = await Promise.all([
    listPublishedArticles({
      categorySlug: sp.get("category") ?? undefined,
      q: sp.get("q") ?? undefined,
      page: Number(sp.get("page")) || 1,
      perPage: Number(sp.get("perPage")) || 12,
    }),
    listReaderCategories(),
  ]);
  return NextResponse.json({ ...feed, categories });
}
