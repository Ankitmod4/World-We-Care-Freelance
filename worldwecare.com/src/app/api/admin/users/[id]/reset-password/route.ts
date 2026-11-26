/**
 * POST /api/admin/users/[id]/reset-password
 *
 * Sends the `password_reset` template to the user by email.
 * At this stage we don't have a real token store — the email that
 * lands includes a demo reset link so the flow can be tested end
 * to end. Real token generation lands with the password-reset
 * feature.
 */

import { AdminAction, type Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/email";
import { getSetting } from "@/lib/settings";
import { logAdminAction } from "@/lib/admin-action-log";
import { appBaseUrl } from "@/lib/app-url";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const siteName = await getSetting<string>("general.siteName", "WorldWeCare");
  const appUrl = appBaseUrl(request);

  const result = await sendEmail({
    templateSlug: "password_reset",
    to: user.email,
    variables: {
      name: user.displayName,
      siteName,
      appUrl,
      // Placeholder until the reset-token generator lands. Admins
      // triggering this from here should follow up with the user out
      // of band OR wait until the real flow ships.
      resetLink: `${appUrl}reset/admin-triggered`,
    },
  });

  await logAdminAction({
    adminId: auth.id,
    action: AdminAction.USER_PASSWORD_RESET_SENT,
    targetUserId: id,
    meta: {
      status: result.status,
      providerId: result.providerId ?? null,
    } as unknown as Prisma.InputJsonValue,
    userFacingMessage: "An admin triggered a password reset email.",
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.message ?? "Send failed" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
