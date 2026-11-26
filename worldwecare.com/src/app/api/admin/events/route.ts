/** GET list / POST create events (admin). */
import { NextRequest, NextResponse } from "next/server";
import type { EventStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin-auth";
import { createEventAsAdmin, listAdminEvents, type EventWriteInput } from "@/lib/events";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const sp = request.nextUrl.searchParams;
  return NextResponse.json(
    await listAdminEvents({
      status: (sp.get("status") as EventStatus | "ALL") ?? "ALL",
      q: sp.get("q") ?? undefined,
      page: Number(sp.get("page")) || 1,
      perPage: Number(sp.get("perPage")) || 20,
    }),
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => ({}))) as EventWriteInput;
  try {
    const event = await createEventAsAdmin(body, { id: auth.id, displayName: auth.displayName });
    return NextResponse.json({ ok: true, id: event.id, slug: event.slug }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed" },
      { status: 400 },
    );
  }
}
