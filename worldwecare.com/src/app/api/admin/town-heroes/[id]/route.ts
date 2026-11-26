/**
 * POST /api/admin/town-heroes/[id] — { action: "approve" | "reject", reason? }
 * PATCH — edit the nomination before or after it goes out.
 * DELETE — remove it entirely.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { reviewTownHero, updateTownHero, deleteTownHero } from "@/lib/town-heroes";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as { action?: unknown; reason?: unknown };
  if (b.action !== "approve" && b.action !== "reject") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  try {
    const res = await reviewTownHero(
      id,
      b.action,
      auth.id,
      typeof b.reason === "string" ? b.reason : null,
    );
    return NextResponse.json(res);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  try {
    await updateTownHero(id, {
      heroName: str(b.heroName),
      town: str(b.town),
      countryId: str(b.countryId),
      photoUrl: str(b.photoUrl),
      photoAlt: str(b.photoAlt),
      summary: str(b.summary),
      body: str(b.body),
      isFeatured: typeof b.isFeatured === "boolean" ? b.isFeatured : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await deleteTownHero(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 400 },
    );
  }
}
