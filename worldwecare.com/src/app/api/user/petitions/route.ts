/**
 * GET  /api/user/petitions — approved petitions.
 * POST /api/user/petitions — start one. Lands PENDING.
 *
 * GET is open: a petition is a public argument, and requiring an
 * account to read one defeats the point of running it.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";
import { listPetitions, submitPetition } from "@/lib/petitions";
import { categoryIdForSlug } from "@/lib/petition-categories";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewer = await getCurrentUser();
  const sp = new URL(request.url).searchParams;
  // ?category=<slug>, so the category page's URL and the request it
  // makes say the same thing. An unknown slug means no filter rather
  // than an error — a stale link shows everything, not a dead end.
  const petitions = await listPetitions({
    viewerId: viewer?.id ?? null,
    countryId: sp.get("country"),
    categoryId: await categoryIdForSlug(sp.get("category")),
    openOnly: sp.get("open") === "1",
    take: Number(sp.get("take")) || undefined,
    page: Number(sp.get("page")) || undefined,
  });
  return NextResponse.json({ petitions }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Expected a JSON object." }, { status: 400 });

  let result;
  try {
    result = await submitPetition(
      {
        title: String(body.title ?? ""),
        summary: body.summary == null ? null : String(body.summary),
        body: String(body.body ?? ""),
        target: String(body.target ?? ""),
        goal: body.goal == null ? null : Number(body.goal),
        countryId: body.countryId == null ? null : String(body.countryId),
        categoryId: body.categoryId == null ? null : String(body.categoryId),
        closesAt: body.closesAt == null ? null : String(body.closesAt),
        coverUrl: body.coverUrl == null ? null : String(body.coverUrl),
        photos: Array.isArray(body.photos)
          ? (body.photos as Array<{ url?: unknown; alt?: unknown }>)
          : null,
        videoAssetId: body.videoAssetId == null ? null : String(body.videoAssetId),
      },
      { id: viewer.id, displayName: viewer.displayName, avatarUrl: viewer.avatarUrl },
    );
  } catch (err) {
    // The video checks throw with something worth reading — "still
    // processing", "belongs to someone else". A 500 here would lose
    // the one sentence that tells the person what to do about it.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't start that petition." },
      { status: 400 },
    );
  }

  if (!result.ok) {
    const messages = {
      TITLE: "Give the petition a clear title — at least a few words.",
      TARGET: "Say who this is addressed to.",
      BODY: "Explain what you're asking for and why. A couple of sentences at least.",
      CATEGORY: "Choose what this petition is about.",
    };
    return NextResponse.json({ error: messages[result.error] }, { status: 400 });
  }

  return NextResponse.json({ slug: result.slug }, { status: 201 });
}
