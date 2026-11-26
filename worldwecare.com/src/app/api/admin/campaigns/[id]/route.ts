/** GET one · PATCH · DELETE. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  deleteCampaign,
  getAdminCampaign,
  updateCampaign,
  type CampaignWriteInput,
} from "@/lib/campaigns-admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const campaign = await getAdminCampaign(id);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ campaign });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Partial<CampaignWriteInput>;
  try {
    return NextResponse.json({ ok: true, ...(await updateCampaign(id, body)) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.role === "MODERATOR") {
    return NextResponse.json({ error: "Moderators can't delete a campaign." }, { status: 403 });
  }
  const { id } = await params;
  await deleteCampaign(id);
  return NextResponse.json({ ok: true });
}
