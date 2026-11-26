/** GET one theme with its clips · PATCH · DELETE. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  deleteLibraryTheme,
  getAdminLibraryTheme,
  listAdminClips,
  updateLibraryTheme,
  type LibraryThemeWriteInput,
} from "@/lib/library-admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const theme = await getAdminLibraryTheme(id);
  if (!theme) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ theme, clips: await listAdminClips(id) });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Partial<LibraryThemeWriteInput>;
  try {
    return NextResponse.json({ ok: true, ...(await updateLibraryTheme(id, body)) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
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
  if (auth.role === "MODERATOR") {
    return NextResponse.json(
      { error: "Moderators can't delete a theme — it takes its clips with it." },
      { status: 403 },
    );
  }
  const { id } = await params;
  await deleteLibraryTheme(id, auth.id);
  return NextResponse.json({ ok: true });
}
