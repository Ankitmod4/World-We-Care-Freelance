/** GET /api/user/saved/articles — the signed-in reader's bookmarked articles. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listSavedArticles } from "@/lib/articles";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ articles: await listSavedArticles(auth.id) });
}
