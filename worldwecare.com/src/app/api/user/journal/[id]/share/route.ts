/**
 * POST /api/user/journal/[id]/share — publish one entry as a post.
 *
 * The only route in the journal that makes anything public, which is
 * why it is its own endpoint rather than a flag on PATCH: a share is
 * never something that can happen as a side effect of saving.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { shareEntry, JournalRefused } from "@/lib/journal";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as { isAnonymous?: unknown };
  try {
    return NextResponse.json(await shareEntry(auth.id, id, { isAnonymous: b.isAnonymous === true }));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof JournalRefused ? err.message : "Couldn't share that." },
      { status: 400 },
    );
  }
}
