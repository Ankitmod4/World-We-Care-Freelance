/**
 * POST — approve, reject or close a petition.
 *
 * `close` rather than `delete` is the normal end: the signatures are
 * other people's and the record of who signed what is the point of
 * having run it. Deletion lives on the DELETE route and is for
 * content that should not exist at all.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { closePetitionAsAdmin, reviewPetition } from "@/lib/petitions-admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string; reason?: string };

  try {
    if (body.action === "close") {
      await closePetitionAsAdmin(id);
      return NextResponse.json({ ok: true, status: "CLOSED" });
    }
    if (body.action !== "approve" && body.action !== "reject") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      ...(await reviewPetition(id, auth.id, body.action, body.reason)),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Review failed";
    return NextResponse.json({ error: msg }, { status: msg === "Petition not found" ? 404 : 400 });
  }
}
