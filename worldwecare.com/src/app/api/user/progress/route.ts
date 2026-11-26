/** GET /api/user/progress — streaks, badges and the journal count. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listStreaks } from "@/lib/streaks";
import { badgeProgress, recomputeBadges } from "@/lib/badges";
import { journalingStreak } from "@/lib/journal";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  // Recomputed on read rather than hooked into a dozen write paths —
  // the same self-healing choice the article counters make, and it
  // cannot be missed because a fire-and-forget hook swallowed an error.
  await recomputeBadges(auth.id);

  const [streaks, badges, journalDays] = await Promise.all([
    listStreaks(auth.id),
    badgeProgress(auth.id),
    journalingStreak(auth.id),
  ]);

  return NextResponse.json({ streaks, badges, journalDays });
}
