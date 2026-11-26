/**
 * POST — approve or reject a campaign a member submitted.
 *
 * `categoryId` may come along with an approval: a submission arrives
 * with the member's choice, and the reviewer is the one who can tell
 * whether it is the right shelf. Approving is also the last moment it
 * can be fixed before readers start browsing by it.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { reviewCampaign } from "@/lib/campaigns-admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    reason?: string;
    categoryId?: string | null;
  };

  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  try {
    return NextResponse.json({
      ok: true,
      ...(await reviewCampaign(id, auth.id, body.action, {
        reason: body.reason,
        categoryId: body.categoryId,
      })),
    });
  } catch (err) {
    // The category refusals throw with a sentence worth reading — "it
    // won't appear under any tile". A 500 would lose the one line that
    // tells the reviewer what to do about it.
    const msg = err instanceof Error ? err.message : "Review failed";
    return NextResponse.json({ error: msg }, { status: msg === "Campaign not found" ? 404 : 400 });
  }
}
