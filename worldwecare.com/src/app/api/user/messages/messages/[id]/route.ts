import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { deleteMessage } from "@/lib/dm";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await deleteMessage(auth.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
