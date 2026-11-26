/**
 * POST /api/admin/users/[id]/send-email
 *
 * Send an arbitrary email template to the user with admin-supplied
 * variable values. Handy for one-off transactional sends (manual
 * welcome resend, custom notice) without leaving the user page.
 *
 * Body:
 *   { templateSlug: string, variables?: Record<string, string> }
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

  const body = (await request.json().catch(() => ({}))) as {
    templateSlug?: string;
    variables?: Record<string, string>;
  };
  const templateSlug = (body.templateSlug ?? "").trim();
  if (!templateSlug) {
    return NextResponse.json(
      { error: "templateSlug is required" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const siteName = await getSetting<string>("general.siteName", "WorldWeCare");
  const supportEmail = await getSetting<string>("general.supportEmail", "");
  const appUrl = appBaseUrl(request);

  const variables: Record<string, string> = {
    name: user.displayName,
    email: user.email,
    siteName,
    appUrl,
    supportEmail: supportEmail || `support@${new URL(appUrl).host}`,
    confirmLink: `${appUrl}confirm/admin-triggered`,
    resetLink: `${appUrl}reset/admin-triggered`,
    ...(body.variables ?? {}),
  };

  const result = await sendEmail({
    templateSlug,
    to: user.email,
    variables,
  });

  await logAdminAction({
    adminId: auth.id,
    action: AdminAction.USER_EMAIL_SENT,
    targetUserId: id,
    meta: {
      templateSlug,
      status: result.status,
      providerId: result.providerId ?? null,
    } as unknown as Prisma.InputJsonValue,
    userFacingMessage: `An admin sent you a "${templateSlug}" email.`,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.message ?? "Send failed" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
