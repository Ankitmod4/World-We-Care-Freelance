/** GET — the moderation queue. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listAdminPetitions } from "@/lib/petitions-admin";
import type { PetitionStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const sp = new URL(request.url).searchParams;
  const petitions = await listAdminPetitions({
    status: (sp.get("status") as PetitionStatus | "ALL" | null) ?? "ALL",
    q: sp.get("q") ?? undefined,
  });
  return NextResponse.json({ petitions });
}
