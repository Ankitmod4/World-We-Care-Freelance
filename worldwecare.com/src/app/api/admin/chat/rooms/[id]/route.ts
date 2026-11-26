/** GET detail / PATCH update / DELETE a chat room. */
import { NextRequest, NextResponse } from "next/server";
import type { ChatTier } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { deleteRoom, getRoomAdmin, updateRoom } from "@/lib/chat-admin";

const TIERS = ["PUBLIC", "SUPPORT", "CRISIS", "CAVALRY"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const room = await getRoomAdmin(id);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  return NextResponse.json({ room });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    await updateRoom(id, {
      name: typeof b.name === "string" ? b.name : (undefined as unknown as string),
      slug: typeof b.slug === "string" ? b.slug : undefined,
      description: b.description === null || typeof b.description === "string" ? (b.description as string | null) : undefined,
      tier: TIERS.includes(b.tier as string) ? (b.tier as ChatTier) : undefined,
      status: b.status === "ACTIVE" || b.status === "ARCHIVED" ? b.status : undefined,
      categoryId: b.categoryId === null || typeof b.categoryId === "string" ? (b.categoryId as string | null) : undefined,
      countryId: b.countryId === null || typeof b.countryId === "string" ? (b.countryId as string | null) : undefined,
      emoji: b.emoji === null || typeof b.emoji === "string" ? (b.emoji as string | null) : undefined,
      color: b.color === null || typeof b.color === "string" ? (b.color as string | null) : undefined,
      allowAnonymous: typeof b.allowAnonymous === "boolean" ? b.allowAnonymous : undefined,
      isFeatured: typeof b.isFeatured === "boolean" ? b.isFeatured : undefined,
      sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : undefined,
      slowModeSeconds: typeof b.slowModeSeconds === "number" ? b.slowModeSeconds : undefined,
      rulesText: b.rulesText === null || typeof b.rulesText === "string" ? (b.rulesText as string | null) : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    await deleteRoom(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed" }, { status: 400 });
  }
}
