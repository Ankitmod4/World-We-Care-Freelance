/**
 * GET  /api/user/chatrooms/[slug]/messages — list (supports ?before / ?after / ?limit)
 * POST /api/user/chatrooms/[slug]/messages — post a message
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { getRoomForUser, listMessages, postMessage } from "@/lib/chat-user";
import { getBlockedIds } from "@/lib/blocks";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await params;
  const room = await getRoomForUser({ viewerId: auth.id, slug });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (!room.canRead) {
    return NextResponse.json({ error: "Join this room to read messages", locked: true }, { status: 403 });
  }
  const sp = new URL(request.url).searchParams;
  const page = await listMessages({
    roomId: room.id,
    viewerId: auth.id,
    before: sp.get("before"),
    after: sp.get("after"),
    limit: sp.get("limit") ? Number.parseInt(sp.get("limit")!, 10) : undefined,
    blockedIds: await getBlockedIds(auth.id),
  });
  return NextResponse.json(page);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { slug } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    body?: unknown;
    isAnonymous?: unknown;
    replyToId?: unknown;
    attachments?: unknown;
    mentions?: unknown;
  };
  if (typeof body.body !== "string") {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  const attachments = Array.isArray(body.attachments)
    ? body.attachments.filter(
        (a): a is { url: string } => !!a && typeof a === "object" && typeof (a as { url?: unknown }).url === "string",
      )
    : undefined;
  const mentions = Array.isArray(body.mentions)
    ? body.mentions.filter((m): m is string => typeof m === "string")
    : undefined;
  try {
    const res = await postMessage({
      slug,
      viewerId: auth.id,
      userName: auth.displayName,
      userAvatar: auth.avatarUrl,
      body: body.body,
      isAnonymous: body.isAnonymous === true,
      replyToId: typeof body.replyToId === "string" ? body.replyToId : undefined,
      attachments,
      mentions,
    });
    return NextResponse.json({ ok: true, ...res }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Post failed";
    return NextResponse.json({ error: msg }, { status: msg === "Room not found" ? 404 : 400 });
  }
}
