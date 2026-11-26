/** GET list / POST create chat rooms. */
import { NextRequest, NextResponse } from "next/server";
import type { ChatTier } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { createRoom, listRooms } from "@/lib/chat-admin";

const TIERS = ["PUBLIC", "SUPPORT", "CRISIS", "CAVALRY"];

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const sp = new URL(request.url).searchParams;
  const statusRaw = sp.get("status") ?? "all";
  const tierRaw = sp.get("tier") ?? "all";
  const rooms = await listRooms({
    q: sp.get("q") ?? undefined,
    status: statusRaw === "active" || statusRaw === "archived" ? statusRaw : "all",
    tier: TIERS.includes(tierRaw) ? (tierRaw as ChatTier) : "all",
    categoryId: sp.get("categoryId") ?? undefined,
  });
  return NextResponse.json({ rooms });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof b.name !== "string" || !b.name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  try {
    const room = await createRoom(
      {
        name: b.name,
        slug: typeof b.slug === "string" ? b.slug : undefined,
        description: typeof b.description === "string" ? b.description : undefined,
        tier: TIERS.includes(b.tier as string) ? (b.tier as ChatTier) : "PUBLIC",
        status: b.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
        categoryId: typeof b.categoryId === "string" ? b.categoryId : null,
        countryId: typeof b.countryId === "string" ? b.countryId : null,
        emoji: typeof b.emoji === "string" ? b.emoji : null,
        color: typeof b.color === "string" ? b.color : null,
        allowAnonymous: typeof b.allowAnonymous === "boolean" ? b.allowAnonymous : undefined,
        isFeatured: typeof b.isFeatured === "boolean" ? b.isFeatured : undefined,
        sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : undefined,
        slowModeSeconds: typeof b.slowModeSeconds === "number" ? b.slowModeSeconds : undefined,
        rulesText: typeof b.rulesText === "string" ? b.rulesText : undefined,
      },
      auth.id,
    );
    return NextResponse.json({ ok: true, id: room.id, slug: room.slug }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Create failed" }, { status: 400 });
  }
}
