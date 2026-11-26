/**
 * GET    /api/user/petitions/[slug] — one petition and its signers.
 * DELETE /api/user/petitions/[slug] — the creator closing their own.
 *
 * DELETE closes rather than deletes. The signatures are other people's
 * — they signed something and are entitled to have that counted, so
 * the creator can stop collecting but cannot erase the record.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";
import { closePetition, getPetitionBySlug, listSignatures } from "@/lib/petitions";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  const petition = await getPetitionBySlug(slug, viewer?.id ?? null);
  if (!petition) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const signatures = await listSignatures(petition.id);
  return NextResponse.json(
    { petition, signatures },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const done = await closePetition(slug, viewer.id);
  if (!done) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
