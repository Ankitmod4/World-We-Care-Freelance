/** POST — toggle following a theme. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { toggleThemeFollow } from "@/lib/library";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    return NextResponse.json(await toggleThemeFollow(id, auth.id));
  } catch {
    return NextResponse.json({ error: "Could not update" }, { status: 400 });
  }
}
