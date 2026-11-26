/** GET list · POST create. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  createCampaign,
  listAdminCampaigns,
  type CampaignStatusValue,
  type CampaignWriteInput,
} from "@/lib/campaigns-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const status = request.nextUrl.searchParams.get("status") as CampaignStatusValue | "ALL" | null;
  return NextResponse.json({ campaigns: await listAdminCampaigns({ status: status ?? "ALL" }) });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => ({}))) as CampaignWriteInput;
  try {
    const campaign = await createCampaign(body, auth.id);
    return NextResponse.json({ ok: true, ...campaign }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed" },
      { status: 400 },
    );
  }
}
