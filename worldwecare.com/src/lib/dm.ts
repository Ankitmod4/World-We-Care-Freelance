/**
 * Direct messages — 1:1 threads with a request/pending inbox, seen
 * receipts, unread counts and typing. Pair is stored sorted so a
 * conversation is unique per pair. Blocking (either direction) hides
 * and forbids messaging; bodies are banned-word masked at read time.
 * DMs are always identified (never anonymous).
 */
import { prisma } from "./db";
import { getMasker } from "./banned-words";
import { isFollowing } from "./follows";

const BODY_MAX = 4000;

function pair(a: string, b: string): { userAId: string; userBId: string } {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

async function areBlocked(a: string, b: string): Promise<boolean> {
  const row = await prisma.userBlock.findFirst({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    select: { id: true },
  });
  return !!row;
}

async function userMini(ids: string[]) {
  if (!ids.length) return new Map<string, { id: string; displayName: string; avatarUrl: string | null }>();
  const rows = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, displayName: true, avatarUrl: true },
  });
  return new Map(rows.map((u) => [u.id, u]));
}

export interface ConversationSummary {
  id: string;
  otherId: string;
  otherName: string;
  otherAvatar: string | null;
  lastMessageText: string | null;
  lastMessageAt: string;
  lastSenderId: string | null;
  unread: number;
  isAccepted: boolean;
}

/** Inbox ("primary") or the pending "requests" box for a viewer. */
export async function listConversations(
  viewerId: string,
  box: "primary" | "requests",
): Promise<ConversationSummary[]> {
  const parts = await prisma.conversationParticipant.findMany({
    where: { userId: viewerId, isAccepted: box === "primary", archivedAt: null },
    include: { conversation: true },
    orderBy: { conversation: { lastMessageAt: "desc" } },
    take: 100,
  });

  const otherIds = parts.map((p) => (p.conversation.userAId === viewerId ? p.conversation.userBId : p.conversation.userAId));
  const [users, mask, blockedIds] = await Promise.all([
    userMini(otherIds),
    getMasker(),
    getBlockedSet(viewerId),
  ]);

  const out: ConversationSummary[] = [];
  for (const p of parts) {
    const c = p.conversation;
    const otherId = c.userAId === viewerId ? c.userBId : c.userAId;
    if (blockedIds.has(otherId)) continue; // hide blocked threads
    const unread = await prisma.directMessage.count({
      where: {
        conversationId: c.id,
        senderId: { not: viewerId },
        deletedAt: null,
        ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
      },
    });
    const u = users.get(otherId);
    out.push({
      id: c.id,
      otherId,
      otherName: u?.displayName ?? "Member",
      otherAvatar: u?.avatarUrl ?? null,
      lastMessageText: c.lastMessageText ? mask(c.lastMessageText) : null,
      lastMessageAt: c.lastMessageAt.toISOString(),
      lastSenderId: c.lastSenderId,
      unread,
      isAccepted: p.isAccepted,
    });
  }
  return out;
}

async function getBlockedSet(viewerId: string): Promise<Set<string>> {
  const rows = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  });
  const set = new Set<string>();
  for (const r of rows) set.add(r.blockerId === viewerId ? r.blockedId : r.blockerId);
  return set;
}

export interface DmMessage {
  id: string;
  senderId: string;
  body: string;
  imageUrl: string | null;
  deleted: boolean;
  isOwn: boolean;
  createdAt: string;
}

export interface ThreadView {
  conversationId: string | null;
  other: { id: string; name: string; avatar: string | null } | null;
  isAccepted: boolean;      // viewer's own accepted state
  isRequest: boolean;       // this thread is a pending request FOR the viewer
  blocked: boolean;
  otherLastReadAt: string | null;
  messages: DmMessage[];
  nextCursor: string | null;
}

/** Thread with a specific user. Returns a virtual empty thread when no
 *  conversation exists yet (so the composer can start one). */
export async function getThread(
  viewerId: string,
  otherId: string,
  cursor?: string | null,
  limit = 30,
): Promise<ThreadView | null> {
  if (otherId === viewerId) return null;
  const other = (await userMini([otherId])).get(otherId);
  if (!other) return null;
  const blocked = await areBlocked(viewerId, otherId);

  const { userAId, userBId } = pair(viewerId, otherId);
  const convo = await prisma.conversation.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
    include: { participants: true },
  });

  if (!convo) {
    return {
      conversationId: null,
      other: { id: other.id, name: other.displayName, avatar: other.avatarUrl },
      isAccepted: true,
      isRequest: false,
      blocked,
      otherLastReadAt: null,
      messages: [],
      nextCursor: null,
    };
  }

  const mine = convo.participants.find((p) => p.userId === viewerId);
  const theirs = convo.participants.find((p) => p.userId === otherId);

  const take = Math.min(50, Math.max(10, limit));
  const cur = cursor ? decodeCursor(cursor) : null;
  const rows = await prisma.directMessage.findMany({
    where: {
      conversationId: convo.id,
      ...(cur ? { OR: [{ createdAt: { lt: cur.createdAt } }, { createdAt: cur.createdAt, id: { lt: cur.id } }] } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
  });
  const hasMore = rows.length > take;
  const slice = (hasMore ? rows.slice(0, take) : rows).reverse(); // chronological
  const mask = await getMasker();

  const messages: DmMessage[] = slice.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    body: m.deletedAt ? "" : mask(m.body),
    imageUrl: m.deletedAt ? null : m.imageUrl,
    deleted: !!m.deletedAt,
    isOwn: m.senderId === viewerId,
    createdAt: m.createdAt.toISOString(),
  }));

  const oldest = hasMore ? slice[0] : null;

  return {
    conversationId: convo.id,
    other: { id: other.id, name: other.displayName, avatar: other.avatarUrl },
    isAccepted: mine?.isAccepted ?? true,
    isRequest: mine ? !mine.isAccepted : false,
    blocked,
    otherLastReadAt: theirs?.lastReadAt?.toISOString() ?? null,
    messages,
    nextCursor: oldest ? encodeCursor({ createdAt: oldest.createdAt, id: oldest.id }) : null,
  };
}

export async function sendMessage(
  viewerId: string,
  otherId: string,
  input: { body: string; imageUrl?: string | null },
): Promise<{ conversationId: string; message: DmMessage }> {
  if (otherId === viewerId) throw new Error("You can't message yourself.");
  const body = (input.body ?? "").trim();
  const imageUrl = input.imageUrl?.trim() || null;
  if (!body && !imageUrl) throw new Error("Write a message first.");
  if (body.length > BODY_MAX) throw new Error("Message is too long.");
  if (await areBlocked(viewerId, otherId)) throw new Error("You can't message this member.");

  const { userAId, userBId } = pair(viewerId, otherId);
  let convo = await prisma.conversation.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
    include: { participants: true },
  });

  if (!convo) {
    // First-ever message: recipient's thread is a request unless they
    // already follow the sender.
    const recipientFollowsSender = await isFollowing(otherId, viewerId);
    convo = await prisma.conversation.create({
      data: {
        userAId,
        userBId,
        lastMessageAt: new Date(),
        participants: {
          create: [
            { userId: viewerId, isAccepted: true },
            { userId: otherId, isAccepted: recipientFollowsSender },
          ],
        },
      },
      include: { participants: true },
    });
  } else {
    // Sending implies the sender has accepted their side.
    const mine = convo.participants.find((p) => p.userId === viewerId);
    if (mine && !mine.isAccepted) {
      await prisma.conversationParticipant.update({ where: { id: mine.id }, data: { isAccepted: true } });
    }
  }

  const message = await prisma.directMessage.create({
    data: { conversationId: convo.id, senderId: viewerId, body, imageUrl },
  });

  const preview = body || "📷 Photo";
  await prisma.$transaction([
    prisma.conversation.update({
      where: { id: convo.id },
      data: { lastMessageAt: message.createdAt, lastMessageText: preview.slice(0, 300), lastSenderId: viewerId },
    }),
    // Sender has "read" their own message; clear their typing flag.
    prisma.conversationParticipant.updateMany({
      where: { conversationId: convo.id, userId: viewerId },
      data: { lastReadAt: message.createdAt, typingAt: null },
    }),
  ]);

  // No bell notification for DMs — the unread count on the header
  // Messages icon is the single source of truth.
  const mask = await getMasker();

  return {
    conversationId: convo.id,
    message: {
      id: message.id,
      senderId: viewerId,
      body: mask(message.body),
      imageUrl: message.imageUrl,
      deleted: false,
      isOwn: true,
      createdAt: message.createdAt.toISOString(),
    },
  };
}

export async function markRead(viewerId: string, conversationId: string): Promise<void> {
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId: viewerId },
    data: { lastReadAt: new Date() },
  });
}

export async function acceptRequest(viewerId: string, conversationId: string): Promise<void> {
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId: viewerId },
    data: { isAccepted: true },
  });
}

/** Decline = delete the whole thread (1:1). */
export async function declineRequest(viewerId: string, conversationId: string): Promise<void> {
  const part = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: viewerId },
    select: { id: true },
  });
  if (!part) throw new Error("Not found.");
  await prisma.conversation.delete({ where: { id: conversationId } });
}

export async function deleteMessage(viewerId: string, messageId: string): Promise<void> {
  const m = await prisma.directMessage.findUnique({ where: { id: messageId }, select: { senderId: true } });
  if (!m) return;
  if (m.senderId !== viewerId) throw new Error("You can only delete your own messages.");
  await prisma.directMessage.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
}

export async function setTyping(viewerId: string, conversationId: string): Promise<void> {
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId: viewerId },
    data: { typingAt: new Date() },
  });
}

/** For the SSE stream: new messages after cursor + the other side's
 *  read + typing state. */
export async function pollThread(
  viewerId: string,
  conversationId: string,
  after: Date,
): Promise<{ messages: DmMessage[]; otherLastReadAt: string | null; otherTyping: boolean } | null> {
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  });
  if (!convo) return null;
  if (!convo.participants.some((p) => p.userId === viewerId)) return null;
  const theirs = convo.participants.find((p) => p.userId !== viewerId);

  const rows = await prisma.directMessage.findMany({
    where: { conversationId, createdAt: { gt: after } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 50,
  });
  const mask = await getMasker();
  const messages: DmMessage[] = rows.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    body: m.deletedAt ? "" : mask(m.body),
    imageUrl: m.deletedAt ? null : m.imageUrl,
    deleted: !!m.deletedAt,
    isOwn: m.senderId === viewerId,
    createdAt: m.createdAt.toISOString(),
  }));
  const typingFresh = theirs?.typingAt ? Date.now() - theirs.typingAt.getTime() < 6000 : false;
  return {
    messages,
    otherLastReadAt: theirs?.lastReadAt?.toISOString() ?? null,
    otherTyping: typingFresh,
  };
}

export async function unreadTotals(viewerId: string): Promise<{ inbox: number; requests: number }> {
  const parts = await prisma.conversationParticipant.findMany({
    where: { userId: viewerId, archivedAt: null },
    include: { conversation: { select: { id: true } } },
  });
  let inbox = 0;
  let requests = 0;
  for (const p of parts) {
    const cnt = await prisma.directMessage.count({
      where: {
        conversationId: p.conversationId,
        senderId: { not: viewerId },
        deletedAt: null,
        ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
      },
    });
    if (cnt > 0) {
      if (p.isAccepted) inbox += 1;
      else requests += 1;
    }
  }
  return { inbox, requests };
}

function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString("base64url");
}
function decodeCursor(c: string): { createdAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(c, "base64url").toString("utf8").split("|");
    const d = new Date(iso);
    if (!id || Number.isNaN(d.getTime())) return null;
    return { createdAt: d, id };
  } catch {
    return null;
  }
}
