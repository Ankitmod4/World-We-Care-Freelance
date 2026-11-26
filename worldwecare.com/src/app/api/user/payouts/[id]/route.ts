/** DELETE — the member cancels their own pending request. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { cancelPayout } from "@/lib/payouts";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  // Only while still REQUESTED — once an admin has approved it the
  // money may already be moving, and the member pulling it out from
  // underneath them is how a double payment happens.
  const ok = await cancelPayout(auth.id, id);
  if (!ok) {
    return NextResponse.json(
      { error: "That request has already been picked up and can't be cancelled." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
