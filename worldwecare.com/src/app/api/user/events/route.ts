/**
 * GET  — the public events calendar (approved only).
 * POST — a member submits an event; it lands in the admin queue.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/user-auth";
import { listEvents, submitEvent, type EventWriteInput } from "@/lib/events";
import { categoryIdForSlug } from "@/lib/event-categories";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  // Slug in the URL, id in the query — the slug is what's shareable.
  const categorySlug = sp.get("category");
  const categoryId = categorySlug ? await categoryIdForSlug(categorySlug) : null;

  return NextResponse.json(
    await listEvents({
      countryId: sp.get("countryId"),
      categoryId,
      q: sp.get("q") ?? undefined,
      past: sp.get("past") === "1",
      page: Number(sp.get("page")) || 1,
      perPage: Number(sp.get("perPage")) || 12,
    }),
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  // Unverified accounts can read everything but can't put an event in
  // front of the whole community.
  const viewer = await getCurrentUser();
  if (!viewer?.emailVerifiedAt) {
    return NextResponse.json(
      { error: "Verify your email address before submitting an event." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as EventWriteInput;
  try {
    const event = await submitEvent(body, {
      id: auth.id,
      displayName: auth.displayName,
      avatarUrl: auth.avatarUrl,
    });
    return NextResponse.json({ ok: true, id: event.id, slug: event.slug }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not submit the event" },
      { status: 400 },
    );
  }
}
