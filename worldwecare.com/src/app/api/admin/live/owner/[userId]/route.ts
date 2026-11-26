/**
 * POST — stop one member going live, or let them again.
 *
 * Blocking ends whatever they have running; a block that leaves the
 * current broadcast on air is not a block.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { setCanStream } from "@/lib/live-streams";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { userId } = await params;
  const b = (await request.json().catch(() => ({}))) as { allowed?: unknown };
  try {
    return NextResponse.json({ ok: true, ...(await setCanStream(userId, b.allowed === true)) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't change that." },
      { status: 400 },
    );
  }
}
