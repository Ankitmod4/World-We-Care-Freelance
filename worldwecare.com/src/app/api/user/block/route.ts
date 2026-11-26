/** POST /api/user/block — { userId, block?: boolean } (block by default; block:false unblocks). */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { blockUser, unblockUser } from "@/lib/blocks";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const b = (await request.json().catch(() => ({}))) as { userId?: unknown; block?: unknown };
  if (typeof b.userId !== "string" || !b.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  try {
    if (b.block === false) await unblockUser(auth.id, b.userId);
    else await blockUser(auth.id, b.userId);
    return NextResponse.json({ ok: true, blocked: b.block !== false });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
