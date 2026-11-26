/** GET — what's live now · POST — create a stream. */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/user-auth";
import { createStream, listLive, whyNotAllowed } from "@/lib/live-streams";
import { categoryIdForSlug, listPublicCategories } from "@/lib/live-categories";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Signed-out visitors can browse what's on. Anyone can stream, and
  // anyone can watch — a live list behind a login would hide the
  // platform from the person most likely to be lurking.
  const viewer = await getCurrentUser();
  const params = request.nextUrl.searchParams;
  const countryId = params.get("countryId");

  // Accept either the id or the slug. The slug is what appears in
  // shareable /live?category=… links, so it has to work on a cold load
  // where the client hasn't fetched the category list yet.
  const categorySlug = params.get("category");
  const categoryId =
    params.get("categoryId") ?? (categorySlug ? await categoryIdForSlug(categorySlug) : null);
  // A slug that resolves to nothing (retired, renamed, mistyped) must
  // not silently fall back to "everything" — that shows a full grid
  // under a filter the viewer thinks is applied.
  const unknownCategory = !!categorySlug && !categoryId;

  const [streams, categories] = await Promise.all([
    unknownCategory ? Promise.resolve([]) : listLive({ viewerId: viewer?.id ?? null, countryId, categoryId }),
    listPublicCategories(),
  ]);

  return NextResponse.json({
    streams,
    categories,
    unknownCategory,
    // The REASON, not a boolean. A member who can't go live needs to
    // be told why — hiding the button leaves them unable to tell a
    // feature that is switched off from one that was never built.
    blockedReason: viewer ? await whyNotAllowed(viewer.id) : null,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const stream = await createStream({
      userId: auth.id,
      title: String(b.title ?? ""),
      categoryId: String(b.categoryId ?? ""),
      summary: typeof b.summary === "string" ? b.summary : null,
      visibility: b.visibility === "UNLISTED" ? "UNLISTED" : undefined,
    });
    return NextResponse.json({ ok: true, stream }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't create that stream." },
      { status: 400 },
    );
  }
}
