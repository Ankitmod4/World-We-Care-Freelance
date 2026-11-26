/** GET thread with a user; POST send a message to them. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { getThread, sendMessage } from "@/lib/dm";

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { userId } = await params;
  const cursor = new URL(request.url).searchParams.get("cursor");
  const view = await getThread(auth.id, userId, cursor);
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(view);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { userId } = await params;
  const b = (await request.json().catch(() => ({}))) as { body?: unknown; imageUrl?: unknown };
  try {
    const res = await sendMessage(auth.id, userId, {
      body: typeof b.body === "string" ? b.body : "",
      imageUrl: typeof b.imageUrl === "string" ? b.imageUrl : null,
    });
    return NextResponse.json(res, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
