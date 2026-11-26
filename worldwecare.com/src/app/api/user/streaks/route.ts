/** GET /api/user/streaks — the member's own. POST — start one. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listStreaks, startStreak, StreakRefused, STREAK_KINDS } from "@/lib/streaks";
import type { StreakKind } from "@prisma/client";
import { recomputeBadges } from "@/lib/badges";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ streaks: await listStreaks(auth.id) });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const kind = typeof b.kind === "string" && (STREAK_KINDS as readonly string[]).includes(b.kind)
    ? (b.kind as StreakKind)
    : null;
  if (!kind) return NextResponse.json({ error: "Pick what you're tracking." }, { status: 400 });

  try {
    const streak = await startStreak(auth.id, {
      kind,
      startedOn: typeof b.startedOn === "string" ? b.startedOn : "",
      label: typeof b.label === "string" ? b.label : null,
      // NOT `=== true`. The default is public now, and `=== true`
      // would turn every request that omits the field — including any
      // older client — back into a private streak, silently
      // reinstating the old behaviour through the one path that
      // creates them.
      isPublic: b.isPublic === undefined ? undefined : b.isPublic !== false,
    });
    // A backdated start can already have earned a milestone.
    await recomputeBadges(auth.id);
    return NextResponse.json({ streak }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof StreakRefused ? err.message : "Couldn't save that." },
      { status: 400 },
    );
  }
}
