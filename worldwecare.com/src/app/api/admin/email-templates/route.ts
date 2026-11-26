/**
 * GET  /api/admin/email-templates — list every template
 * POST /api/admin/email-templates — create a new template
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const rows = await prisma.emailTemplate.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      subject: true,
      enabled: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ items: rows });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    slug?: string;
    name?: string;
    subject?: string;
    htmlBody?: string;
    textBody?: string;
    previewText?: string;
    description?: string;
    variables?: string[];
  };

  const slug = (body.slug ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  const subject = (body.subject ?? "").trim();
  const htmlBody = body.htmlBody ?? "";

  if (!/^[a-z0-9_]+$/.test(slug)) {
    return NextResponse.json(
      { error: "Slug must be lowercase letters, numbers, and underscores." },
      { status: 400 },
    );
  }
  if (!name || !subject || !htmlBody) {
    return NextResponse.json(
      { error: "Name, subject, and HTML body are required." },
      { status: 400 },
    );
  }

  const existing = await prisma.emailTemplate.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json(
      { error: `Template "${slug}" already exists.` },
      { status: 409 },
    );
  }

  const row = await prisma.emailTemplate.create({
    data: {
      slug,
      name,
      subject,
      htmlBody,
      textBody: body.textBody ?? null,
      previewText: body.previewText ?? null,
      description: body.description ?? null,
      variables: Array.isArray(body.variables) ? body.variables : [],
    },
  });
  return NextResponse.json({ item: row }, { status: 201 });
}
