/**
 * POST — freeze the account.
 *
 * Reversible and destroys nothing: signing in again is what an admin
 * has to re-enable, which is deliberate. Requires the current
 * password, because a borrowed session should not be able to take
 * someone's account away from them even temporarily.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clearUserCookie, requireUser } from "@/lib/user-auth";
import { verifyPassword } from "@/lib/password";
import { deactivateAccount } from "@/lib/account";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    currentPassword?: unknown;
  };
  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    select: { passwordHash: true },
  });
  if (
    !user ||
    typeof body.currentPassword !== "string" ||
    !(await verifyPassword(body.currentPassword, user.passwordHash))
  ) {
    return NextResponse.json(
      { error: "That's not your current password." },
      { status: 400 },
    );
  }

  await deactivateAccount(auth.id);
  await clearUserCookie();
  return NextResponse.json({ ok: true });
}
