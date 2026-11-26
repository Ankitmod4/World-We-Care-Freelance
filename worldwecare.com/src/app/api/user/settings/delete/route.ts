/**
 * POST — erase the account.
 *
 * Two gates, because this one cannot be undone:
 *   • the current password, same as every other account-level action
 *   • the word DELETE typed out, so a mis-click on a phone can't do it
 *
 * `deleteAccount` explains what goes and what is merely detached.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clearUserCookie, requireUser } from "@/lib/user-auth";
import { verifyPassword } from "@/lib/password";
import { deleteAccount } from "@/lib/account";
import { DELETE_CONFIRM_WORD } from "@/lib/delete-confirm";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    currentPassword?: unknown;
    confirm?: unknown;
  };

  if (typeof body.confirm !== "string" || body.confirm.trim() !== DELETE_CONFIRM_WORD) {
    return NextResponse.json(
      { error: `Type ${DELETE_CONFIRM_WORD} to confirm.` },
      { status: 400 },
    );
  }

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

  let removed;
  try {
    removed = await deleteAccount(auth.id);
  } catch {
    return NextResponse.json(
      { error: "Couldn't finish deleting the account. Nothing was lost — try again." },
      { status: 500 },
    );
  }

  await clearUserCookie();
  return NextResponse.json({ ok: true, removed });
}
