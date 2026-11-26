/**
 * GET / PUT / DELETE a single email template.
 *
 * PUT accepts a partial payload — only supplied fields are written.
 * DELETE is soft-blocked for well-known slugs so the app doesn't try
 * to send with a missing template. To retire one, disable it
 * instead.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import type { Prisma } from "@prisma/client";

const PROTECTED_SLUGS = new Set([
  "welcome",
  "email_confirm",
  "password_reset",
  "password_reset_confirmed",
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const row = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 },
    );
  }
  return NextResponse.json({ item: row });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const existing = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    subject?: string;
    htmlBody?: string;
    textBody?: string | null;
    previewText?: string | null;
    description?: string | null;
    variables?: string[];
    enabled?: boolean;
  };

  const data: Prisma.EmailTemplateUpdateInput = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.subject !== undefined) data.subject = body.subject;
  if (body.htmlBody !== undefined) data.htmlBody = body.htmlBody;
  if (body.textBody !== undefined) data.textBody = body.textBody;
  if (body.previewText !== undefined) data.previewText = body.previewText;
  if (body.description !== undefined) data.description = body.description;
  if (body.variables !== undefined) {
    data.variables = (
      Array.isArray(body.variables) ? body.variables : []
    ) as Prisma.InputJsonValue;
  }
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;

  const row = await prisma.emailTemplate.update({ where: { id }, data });
  return NextResponse.json({ item: row });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const row = await prisma.emailTemplate.findUnique({
    where: { id },
    select: { slug: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  if (PROTECTED_SLUGS.has(row.slug)) {
    return NextResponse.json(
      {
        error: `"${row.slug}" is required by the app. Disable it from the editor if you need to stop sends.`,
      },
      { status: 400 },
    );
  }
  await prisma.emailTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
