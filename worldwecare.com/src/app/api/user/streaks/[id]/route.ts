/**
 * PATCH /api/user/streaks/[id] — edit, or reset with `{ reset: true }`.
 * DELETE — remove it, or archive with `?archive=1`.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { editStreak, resetStreak, archiveStreak, deleteStreak, StreakRefused } from "@/lib/streaks";
import { recomputeBadges } from "@/lib/badges";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const streak =
      b.reset === true
        ? await resetStreak(auth.id, id, typeof b.startedOn === "string" ? b.startedOn : "")
        : await editStreak(auth.id, id, {
            startedOn: typeof b.startedOn === "string" ? b.startedOn : undefined,
            label: typeof b.label === "string" ? b.label : undefined,
            isPublic: typeof b.isPublic === "boolean" ? b.isPublic : undefined,
          });
    // "Started again" is itself a badge, and it is earned here.
    await recomputeBadges(auth.id);
    return NextResponse.json({ streak });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof StreakRefused ? err.message : "Couldn't save that." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  try {
    if (searchParams.get("archive") === "1") await archiveStreak(auth.id, id);
    else await deleteStreak(auth.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof StreakRefused ? err.message : "Couldn't do that." },
      { status: 400 },
    );
  }
}
