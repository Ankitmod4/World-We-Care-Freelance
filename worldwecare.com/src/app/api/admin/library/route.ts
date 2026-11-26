/** GET list · POST create — theme themes. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createLibraryTheme, listAdminLibraryThemes, type LibraryThemeWriteInput } from "@/lib/library-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ themes: await listAdminLibraryThemes() });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => ({}))) as LibraryThemeWriteInput;
  try {
    const theme = await createLibraryTheme(body);
    return NextResponse.json({ ok: true, ...theme }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed" },
      { status: 400 },
    );
  }
}
