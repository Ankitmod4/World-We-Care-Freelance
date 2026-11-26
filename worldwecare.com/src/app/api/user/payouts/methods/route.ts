/** GET list / POST add a payout method. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { addMethod, listMethods, METHOD_TYPES, type MethodType } from "@/lib/payouts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ methods: await listMethods(auth.id) });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const type = String(b.type ?? "").toUpperCase() as MethodType;
  if (!METHOD_TYPES.includes(type)) {
    return NextResponse.json({ error: "Pick a payout method." }, { status: 400 });
  }

  const result = await addMethod(
    auth.id,
    type,
    (b.details ?? {}) as Record<string, unknown>,
    typeof b.label === "string" ? b.label : undefined,
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  // Returns the id only. The details just posted are never echoed back.
  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
