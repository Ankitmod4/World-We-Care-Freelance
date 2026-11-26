/** GET /api/user/town-heroes — the list. POST — nominate someone. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listTownHeroes, nominateHero, HeroRefused } from "@/lib/town-heroes";
import { validHeroCategoryId } from "@/lib/town-hero-categories";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(request.url);
  const heroes = await listTownHeroes({
    viewerId: auth.id,
    countryId: searchParams.get("countryId"),
    categorySlug: searchParams.get("category"),
    q: searchParams.get("q"),
    take: Number(searchParams.get("take")) || undefined,
    page: Number(searchParams.get("page")) || undefined,
  });
  return NextResponse.json({ heroes });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  try {
    const hero = await nominateHero(
      { id: auth.id, displayName: auth.displayName },
      {
        heroName: str(b.heroName) ?? "",
        // A category is required now, so an unknown or retired id is
        // refused rather than quietly nulled — silently filing a
        // nomination somewhere the member did not choose would be
        // worse than telling them to pick again.
        categoryId: (await validHeroCategoryId(b.categoryId)) ?? "",
        town: str(b.town),
        countryId: str(b.countryId),
        photoUrl: str(b.photoUrl),
        photoAlt: str(b.photoAlt),
        summary: str(b.summary),
        body: str(b.body) ?? "",
        isAnonymous: b.isAnonymous === true,
      },
    );
    return NextResponse.json({ hero }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof HeroRefused ? err.message : "Couldn't send that nomination." },
      { status: 400 },
    );
  }
}
