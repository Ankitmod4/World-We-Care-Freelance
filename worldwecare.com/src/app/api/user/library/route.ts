/** GET — themes, plus clips for one theme or for everything followed. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listClips, listLibraryThemes } from "@/lib/library";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const sp = request.nextUrl.searchParams;
  const scope = sp.get("scope");

  if (scope === "following") {
    return NextResponse.json(
      await listClips({
        followedBy: auth.id,
        viewerId: auth.id,
        page: Number(sp.get("page")) || 1,
        perPage: Number(sp.get("perPage")) || 24,
      }),
    );
  }
  if (scope === "clips") {
    const themeId = sp.get("themeId");
    if (!themeId) return NextResponse.json({ error: "themeId required" }, { status: 400 });
    return NextResponse.json(
      await listClips({
        themeId,
        viewerId: auth.id,
        page: Number(sp.get("page")) || 1,
        perPage: Number(sp.get("perPage")) || 24,
      }),
    );
  }

  return NextResponse.json({ themes: await listLibraryThemes(auth.id) });
}
