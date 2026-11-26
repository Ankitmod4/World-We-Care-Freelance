/** GET list / POST add banned words (comma/newline separated). */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { addBannedWords, listBannedWords } from "@/lib/banned-words";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ words: await listBannedWords() });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const b = (await request.json().catch(() => ({}))) as { words?: unknown; word?: unknown };
  const input = typeof b.words === "string" ? b.words : typeof b.word === "string" ? b.word : "";
  if (!input.trim()) return NextResponse.json({ error: "Enter a word" }, { status: 400 });
  const added = await addBannedWords(input);
  return NextResponse.json({ ok: true, added });
}
