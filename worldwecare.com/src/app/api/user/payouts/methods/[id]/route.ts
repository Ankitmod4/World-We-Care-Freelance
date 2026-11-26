/** PATCH — make default · DELETE — remove. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { removeMethod, setDefaultMethod } from "@/lib/payouts";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const b = (await request.json().catch(() => ({}))) as { isDefault?: unknown };
  if (b.isDefault !== true) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }
  const ok = await setDefaultMethod(auth.id, id);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const result = await removeMethod(auth.id, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
