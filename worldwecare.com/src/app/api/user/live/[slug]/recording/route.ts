/** POST — the owner turns recording on or off mid-broadcast. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { setRecording } from "@/lib/live-streams";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await params;
  const b = (await request.json().catch(() => ({}))) as { wanted?: unknown };
  try {
    return NextResponse.json(await setRecording(slug, auth.id, b.wanted === true));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't change that." },
      { status: 400 },
    );
  }
}
