/** GET /api/user/messages?box=primary|requests — conversation list. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { listConversations } from "@/lib/dm";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const box = new URL(request.url).searchParams.get("box") === "requests" ? "requests" : "primary";
  return NextResponse.json({ conversations: await listConversations(auth.id, box) });
}
