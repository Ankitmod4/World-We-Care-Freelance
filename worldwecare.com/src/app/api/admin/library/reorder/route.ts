/** POST — persist a drag-reorder of themes, or of one theme's clips. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { reorderClips, reorderLibraryThemes } from "@/lib/library-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => ({}))) as {
    themeId?: string;
    ids?: unknown;
  };
  const ids = Array.isArray(body.ids) ? body.ids.filter((i): i is string => typeof i === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "Nothing to reorder" }, { status: 400 });

  try {
    if (body.themeId) await reorderClips(body.themeId, ids);
    else await reorderLibraryThemes(ids);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not save the order" }, { status: 400 });
  }
}
