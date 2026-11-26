/** PATCH /api/user/journal/[id] — edit. DELETE — remove. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { editEntry, deleteEntry, JournalRefused } from "@/lib/journal";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as { body?: unknown };
  try {
    const entry = await editEntry(auth.id, id, typeof b.body === "string" ? b.body : "");
    return NextResponse.json({ entry });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof JournalRefused ? err.message : "Couldn't save that." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await deleteEntry(auth.id, id);
  return NextResponse.json({ ok: true });
}
