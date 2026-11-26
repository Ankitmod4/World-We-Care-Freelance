/** GET /api/admin/town-heroes — the review queue. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listTownHeroesAdmin } from "@/lib/town-heroes";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as "PENDING" | "APPROVED" | "REJECTED" | "ALL" | null;
  const [heroes, pendingCount] = await Promise.all([
    listTownHeroesAdmin({ status: status ?? "PENDING", q: searchParams.get("q") }),
    prisma.townHero.count({ where: { status: "PENDING" } }),
  ]);
  return NextResponse.json({ heroes, pendingCount });
}
