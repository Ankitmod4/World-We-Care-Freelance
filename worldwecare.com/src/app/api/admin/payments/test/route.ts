/** POST — check a Stripe secret key actually works. */
import { NextRequest, NextResponse } from "next/server";
import { requireMoneyAdmin } from "@/lib/admin-auth";
import { testConnection } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireMoneyAdmin(request, "owner");
  if (auth instanceof NextResponse) return auth;

  const b = (await request.json().catch(() => ({}))) as { secretKey?: unknown };
  // A key typed into the form is tested as typed, so the admin can
  // check it before committing it. Falls back to the stored one.
  const candidate = typeof b.secretKey === "string" && b.secretKey.trim() ? b.secretKey.trim() : undefined;

  const result = await testConnection(candidate);
  // 200 either way — "the key is wrong" is a successful test, and a
  // non-2xx would make the client render a network error instead of
  // the message that explains what's actually wrong.
  return NextResponse.json(result);
}
