/** GET members of a room (?status=all|pending|active|banned). */
import { NextRequest, NextResponse } from "next/server";
import type { ChatMemberStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { listMembers } from "@/lib/chat-admin";

const STATUSES = ["PENDING", "ACTIVE", "BANNED"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const raw = (new URL(request.url).searchParams.get("status") ?? "all").toUpperCase();
  const status = STATUSES.includes(raw) ? (raw as ChatMemberStatus) : "all";
  return NextResponse.json({ members: await listMembers(id, status) });
}
