/** POST /api/user/follow — { userId, follow?: boolean } (follow by default; follow:false unfollows). */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { followUser, unfollowUser } from "@/lib/follows";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const b = (await request.json().catch(() => ({}))) as { userId?: unknown; follow?: unknown };
  if (typeof b.userId !== "string" || !b.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  try {
    if (b.follow === false) await unfollowUser(auth.id, b.userId);
    else await followUser(auth.id, b.userId, auth.displayName);
    return NextResponse.json({ ok: true, following: b.follow !== false });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
