/** GET /api/user/journal — the member's own entries. POST — write one. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listJournal, writeEntry, JournalRefused } from "@/lib/journal";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(request.url);
  // Scoped to auth.id and nothing else — there is no parameter here
  // that could widen it to somebody else's journal.
  return NextResponse.json(
    await listJournal(auth.id, {
      cursor: searchParams.get("cursor"),
      limit: Number(searchParams.get("limit")) || undefined,
    }),
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const b = (await request.json().catch(() => ({}))) as { body?: unknown };
  try {
    const entry = await writeEntry(auth.id, typeof b.body === "string" ? b.body : "");
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof JournalRefused ? err.message : "Couldn't save that." },
      { status: 400 },
    );
  }
}
