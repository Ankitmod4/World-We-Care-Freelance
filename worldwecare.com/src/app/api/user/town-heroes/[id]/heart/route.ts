/** POST /api/user/town-heroes/[id]/heart — toggle applause. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { toggleHeroHeart, HeroRefused } from "@/lib/town-heroes";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    return NextResponse.json(await toggleHeroHeart(auth.id, id));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof HeroRefused ? err.message : "Failed" },
      { status: 400 },
    );
  }
}
