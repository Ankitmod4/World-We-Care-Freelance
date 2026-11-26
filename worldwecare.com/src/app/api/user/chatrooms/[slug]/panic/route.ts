/** POST /api/user/chatrooms/[slug]/panic — alert room moderators + return help resources. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { panicAlert } from "@/lib/chat-user";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await params;
  try {
    const res = await panicAlert({ viewerId: auth.id, slug });
    return NextResponse.json({
      ok: true,
      moderatorsAlerted: res.moderatorsAlerted,
      hotline: {
        region: "US",
        name: "988 Suicide & Crisis Lifeline",
        detail: "Call or text 988 — free, confidential, 24/7.",
        emergency: "If you're in immediate danger, call your local emergency number.",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 400 });
  }
}
