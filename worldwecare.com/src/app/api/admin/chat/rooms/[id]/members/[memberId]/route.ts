/** PATCH member (role / status / approveFirstPost) · DELETE member. */
import { NextRequest, NextResponse } from "next/server";
import type { ChatMemberRole, ChatMemberStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { removeMember, updateMember } from "@/lib/chat-admin";

const ROLES = ["MEMBER", "MODERATOR"];
const STATUSES = ["PENDING", "ACTIVE", "BANNED"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { memberId } = await params;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await updateMember(memberId, {
      role: ROLES.includes(b.role as string) ? (b.role as ChatMemberRole) : undefined,
      status: STATUSES.includes(b.status as string) ? (b.status as ChatMemberStatus) : undefined,
      approveFirstPost: typeof b.approveFirstPost === "boolean" ? b.approveFirstPost : undefined,
      reason: typeof b.reason === "string" ? b.reason : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { memberId } = await params;
  try {
    await removeMember(memberId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Remove failed" }, { status: 400 });
  }
}
