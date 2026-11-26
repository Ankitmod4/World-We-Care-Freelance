/**
 * GET  /api/user/campaigns — published campaigns, scoped to the
 *      reader's country picker.
 * POST /api/user/campaigns — submit one. Lands PENDING.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listCampaigns, submitCampaign } from "@/lib/campaigns";
import { categoryIdForSlug } from "@/lib/campaign-categories";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const sp = request.nextUrl.searchParams;
  return NextResponse.json({
    campaigns: await listCampaigns({
      countryId: sp.get("countryId"),
      viewerId: auth.id,
      // ?category=<slug>, so the category page's URL and the request it
      // makes say the same thing. An unknown slug means no filter
      // rather than an error — a stale link shows everything, not a
      // dead end. Same rule as petitions.
      categoryId: await categoryIdForSlug(sp.get("category")),
      liveOnly: sp.get("live") === "1",
      take: Number(sp.get("take")) || undefined,
      page: Number(sp.get("page")) || undefined,
    }),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Expected a JSON object." }, { status: 400 });

  // Note what is NOT read off the body: status, ctaUrl, startsAt,
  // endsAt, chatRoomId, petitionId. Those are admin curation, and a
  // POST that quietly honoured them would be the review step's back
  // door. `submitCampaign`'s docblock says why for each.
  const result = await submitCampaign(
    {
      title: String(body.title ?? ""),
      summary: body.summary == null ? null : String(body.summary),
      body: String(body.body ?? ""),
      categoryId: body.categoryId == null ? null : String(body.categoryId),
      countryId: body.countryId == null ? null : String(body.countryId),
      coverUrl: body.coverUrl == null ? null : String(body.coverUrl),
      photos: Array.isArray(body.photos)
        ? (body.photos as Array<{ url?: unknown; alt?: unknown }>)
        : null,
    },
    { id: auth.id, displayName: auth.displayName, avatarUrl: auth.avatarUrl },
  );

  if (!result.ok) {
    const messages = {
      TITLE: "Give the campaign a clear title — at least a few words.",
      BODY: "Explain what the campaign is for and what you want to happen. A couple of sentences at least.",
      CATEGORY: "Choose what this campaign is about.",
    };
    return NextResponse.json({ error: messages[result.error] }, { status: 400 });
  }

  return NextResponse.json({ slug: result.slug }, { status: 201 });
}
