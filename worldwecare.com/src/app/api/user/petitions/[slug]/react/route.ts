/**
 * POST /api/user/petitions/[slug]/react — leave, change or take back
 * a reaction.
 *
 * A SEPARATE ENDPOINT FROM /sign, deliberately. Signing is consent
 * with a name attached; reacting is not, and one endpoint doing both
 * would be one refactor away from a reaction quietly counting as a
 * signature. Different route, different table, different counter.
 *
 * Unlike signing, this stays open on a CLOSED petition — the ask is
 * over, but "this mattered" is still worth being able to say.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";
import { prisma } from "@/lib/db";
import { togglePetitionReaction } from "@/lib/petitions";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { type?: unknown };

  const petition = await prisma.petition.findUnique({ where: { slug }, select: { id: true } });
  if (!petition) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    return NextResponse.json(await togglePetitionReaction(viewer.id, petition.id, body.type));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 400 },
    );
  }
}
