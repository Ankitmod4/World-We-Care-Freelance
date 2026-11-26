/** GET my profile · PATCH update it. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { getMyProfile, updateMyProfile } from "@/lib/profile";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const profile = await getMyProfile(auth.id);
  return NextResponse.json({ profile });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await updateMyProfile(auth.id, {
      displayName: typeof b.displayName === "string" ? b.displayName : undefined,
      bio: b.bio === null || typeof b.bio === "string" ? (b.bio as string | null) : undefined,
      location: b.location === null || typeof b.location === "string" ? (b.location as string | null) : undefined,
      avatarUrl: b.avatarUrl === null || typeof b.avatarUrl === "string" ? (b.avatarUrl as string | null) : undefined,
      coverUrl: b.coverUrl === null || typeof b.coverUrl === "string" ? (b.coverUrl as string | null) : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed" }, { status: 400 });
  }
}
