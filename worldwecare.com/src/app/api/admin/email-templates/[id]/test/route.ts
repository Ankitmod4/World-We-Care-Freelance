/**
 * POST /api/admin/email-templates/[id]/test
 *
 * Sends a real email through the delivery provider, using the current template
 * bodies (with sample variables filled in) to a recipient the admin
 * types. Handy for previewing rendering, testing DNS / SPF setup,
 * and confirming the API key is live.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/email";
import { getSetting } from "@/lib/settings";
import { appBaseUrl } from "@/lib/app-url";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as {
    to?: string;
    variables?: Record<string, string>;
  };
  const to = (body.to ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json(
      { error: "Enter a valid recipient email address." },
      { status: 400 },
    );
  }

  const template = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!template) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 },
    );
  }

  // Assemble a helpful default variable bag so the test render looks
  // real even when the admin hasn't typed values in for every slot.
  const siteName = await getSetting<string>("general.siteName", "WorldWeCare");
  const supportEmail = await getSetting<string>("general.supportEmail", "");
  const appUrl = appBaseUrl(request);

  const defaults: Record<string, string> = {
    name: "Alex",
    email: to,
    siteName,
    appUrl,
    supportEmail: supportEmail || `support@${new URL(appUrl).host}`,
    confirmLink: `${appUrl}confirm/test-token`,
    resetLink: `${appUrl}reset/test-token`,
  };
  const variables = { ...defaults, ...(body.variables ?? {}) };

  const result = await sendEmail({
    templateSlug: template.slug,
    to,
    variables,
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, status: result.status, error: result.message },
      { status: 400 },
    );
  }
  return NextResponse.json({
    ok: true,
    status: result.status,
    providerId: result.providerId,
  });
}
