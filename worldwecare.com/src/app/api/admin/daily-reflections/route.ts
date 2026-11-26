import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";

const dateOf = (value: unknown) => {
  const raw = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error("Choose a valid date.");
  return new Date(`${raw}T00:00:00.000Z`);
};

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request); if (auth instanceof NextResponse) return auth;
  const [quotes, questions] = await Promise.all([
    prisma.dailyQuote.findMany({ orderBy: { displayDate: "desc" }, take: 60 }),
    prisma.dailyQuestion.findMany({ orderBy: { displayDate: "desc" }, take: 60, include: { _count: { select: { reflections: true } } } }),
  ]);
  return NextResponse.json({ quotes, questions });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request); if (auth instanceof NextResponse) return auth;
  const input = await request.json().catch(() => ({}));
  const kind = input.kind === "question" ? "question" : input.kind === "quote" ? "quote" : null;
  const body = String(input.body ?? "").trim();
  const maxLength = kind === "quote" ? 500 : 800;
  if (!kind || !body || body.length > maxLength) return NextResponse.json({ error: `${kind === "quote" ? "Quotes" : "Questions"} must be between 1 and ${maxLength} characters.` }, { status: 400 });
  try {
    const displayDate = dateOf(input.displayDate);
    const item = kind === "quote"
      ? await prisma.dailyQuote.create({ data: { body, attribution: String(input.attribution ?? "").trim() || null, displayDate, isActive: input.isActive !== false } })
      : await prisma.dailyQuestion.create({ data: { body, displayDate, isActive: input.isActive !== false } });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : "This date already has content." }, { status: 400 }); }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request); if (auth instanceof NextResponse) return auth;
  const input = await request.json().catch(() => ({}));
  const kind = input.kind === "question" ? "question" : input.kind === "quote" ? "quote" : null;
  const id = String(input.id ?? ""); const body = String(input.body ?? "").trim();
  const maxLength = kind === "quote" ? 500 : 800;
  if (!kind || !id || !body || body.length > maxLength) return NextResponse.json({ error: "Invalid content length." }, { status: 400 });
  try {
    const data = { body, displayDate: dateOf(input.displayDate), isActive: input.isActive !== false };
    const item = kind === "quote" ? await prisma.dailyQuote.update({ where: { id }, data: { ...data, attribution: String(input.attribution ?? "").trim() || null } }) : await prisma.dailyQuestion.update({ where: { id }, data });
    return NextResponse.json({ item });
  } catch { return NextResponse.json({ error: "Could not update this item." }, { status: 400 }); }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request); if (auth instanceof NextResponse) return auth;
  const input = await request.json().catch(() => ({}));
  if (input.kind === "quote") await prisma.dailyQuote.delete({ where: { id: String(input.id) } }).catch(() => null);
  else if (input.kind === "question") await prisma.dailyQuestion.delete({ where: { id: String(input.id) } }).catch(() => null);
  else return NextResponse.json({ error: "Invalid item." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
