/** GET · POST — the member's saved filter sets. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listFilterSets, saveFilterSet } from "@/lib/places";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ sets: await listFilterSets(auth.id) });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => ({}))) as { name?: unknown; filters?: unknown };
  try {
    const set = await saveFilterSet(auth.id, String(body.name ?? ""), body.filters);
    return NextResponse.json({ ok: true, set }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save" },
      { status: 400 },
    );
  }
}
