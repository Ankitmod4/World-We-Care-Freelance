/** POST — toggle the signed-in member's RSVP. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { toggleRsvp } from "@/lib/events";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const res = await toggleRsvp(id, {
      id: auth.id,
      displayName: auth.displayName,
      avatarUrl: auth.avatarUrl,
    });
    return NextResponse.json({ ok: true, ...res });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "RSVP failed";
    return NextResponse.json({ error: msg }, { status: msg === "Event not found" ? 404 : 400 });
  }
}
