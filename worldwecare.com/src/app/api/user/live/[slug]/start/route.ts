/**
 * POST — the owner starts broadcasting.
 *
 * Returns a publish token, so it is never cacheable and never a GET.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { startBroadcast } from "@/lib/live-streams";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await params;
  try {
    return NextResponse.json(await startBroadcast(slug, auth.id), {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't start the broadcast." },
      { status: 400 },
    );
  }
}
