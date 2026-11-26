/** GET — articles, events and chatrooms to attach, filtered by ?q. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { searchAttachables } from "@/lib/campaigns-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(await searchAttachables(request.nextUrl.searchParams.get("q") ?? ""));
}
