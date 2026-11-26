/**
 * User-side chatroom operations.
 *
 * Tier rules (see plan.docx):
 *   PUBLIC  — anyone signed-in can read + post (membership auto-created).
 *   SUPPORT/CRISIS/CAVALRY — join to read; first message held PENDING
 *             until a moderator approves.
 *
 * Also powers: reactions, replies, edit-own, report-a-message, slow
 * mode, a member roster, and per-room moderator actions (pin / remove
 * / approve) for members whose role is MODERATOR.
 */

import type { Prisma, ReportReason } from "@prisma/client";
import { prisma } from "./db";
import { createForAllAdmins } from "./admin-notifications";
import { createManyUserNotifications, createUserNotification } from "./notifications";
import { getMasker, type Masker } from "./banned-words";
import { encodeCursor, newerThan, olderThan, parseCursor } from "./cursor";

export const CHAT_BODY_MAX = 2000;

/** Curated reaction set — kept small + supportive for this platform. */
export const REACTION_EMOJIS = ["❤️", "🙏", "🫂", "👍", "🎉", "😢"];

export interface ChatReactionDto {
  emoji: string;
  count: number;
  mine: boolean;
}
export interface ChatReplyPreview {
  id: string;
  authorName: string;
  body: string;
}
export interface ChatMessageDto {
  id: string;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  body: string;
  isAnonymous: boolean;
  isPinned: boolean;
  isOwn: boolean;
  pending: boolean;
  edited: boolean;
  createdAt: string;
  replyTo: ChatReplyPreview | null;
  reactions: ChatReactionDto[];
  attachments: Array<{ url: string; alt?: string | null }>;
}

type MsgRow = {
  id: string;
  authorId: string | null;
  authorNameSnapshot: string;
  authorAvatarSnapshot: string | null;
  body: string;
  isAnonymous: boolean;
  isPinned: boolean;
  status: "PUBLISHED" | "PENDING" | "REMOVED";
  editedAt: Date | null;
  attachments: unknown;
  createdAt: Date;
  replyTo?: {
    id: string;
    authorNameSnapshot: string;
    isAnonymous: boolean;
    body: string;
  } | null;
  reactions?: Array<{ emoji: string; userId: string }>;
};

function parseAttachments(raw: unknown): Array<{ url: string; alt?: string | null }> {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((i) =>
    i && typeof i === "object" && "url" in i && typeof (i as { url: unknown }).url === "string"
      ? [{ url: (i as { url: string }).url, alt: typeof (i as { alt?: unknown }).alt === "string" ? (i as { alt: string }).alt : null }]
      : [],
  );
}

function mapMessage(m: MsgRow, viewerId: string | null): ChatMessageDto {
  const agg = new Map<string, { count: number; mine: boolean }>();
  for (const rx of m.reactions ?? []) {
    const cur = agg.get(rx.emoji) ?? { count: 0, mine: false };
    cur.count += 1;
    if (viewerId && rx.userId === viewerId) cur.mine = true;
    agg.set(rx.emoji, cur);
  }
  const reactions = [...agg.entries()]
    .map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine }))
    .sort((a, b) => b.count - a.count);

  return {
    id: m.id,
    authorId: m.authorId,
    authorName: m.authorNameSnapshot,
    authorAvatar: m.authorAvatarSnapshot,
    body: m.body,
    isAnonymous: m.isAnonymous,
    isPinned: m.isPinned,
    isOwn: viewerId !== null && m.authorId === viewerId,
    pending: m.status === "PENDING",
    edited: !!m.editedAt,
    createdAt: m.createdAt.toISOString(),
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          authorName: m.replyTo.isAnonymous ? "Anonymous member" : m.replyTo.authorNameSnapshot,
          body: m.replyTo.body,
        }
      : null,
    reactions,
    attachments: parseAttachments(m.attachments),
  };
}

function maskDto(m: ChatMessageDto, mask: Masker): ChatMessageDto {
  m.body = mask(m.body);
  if (m.replyTo) m.replyTo.body = mask(m.replyTo.body);
  return m;
}

const MSG_INCLUDE = {
  replyTo: { select: { id: true, authorNameSnapshot: true, isAnonymous: true, body: true } },
  reactions: { select: { emoji: true, userId: true } },
} as const;

/* ── browse ──────────────────────────────────────────────────── */

export async function listRoomsForUser(opts: { viewerId: string; countryId?: string }) {
  const where: Prisma.ChatRoomWhereInput = { status: "ACTIVE" };
  if (opts.countryId) where.OR = [{ countryId: null }, { countryId: opts.countryId }];

  const rooms = await prisma.chatRoom.findMany({
    where,
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: { category: { select: { id: true, name: true, sortOrder: true } } },
  });

  const memberships = rooms.length
    ? await prisma.chatMembership.findMany({
        where: { userId: opts.viewerId, roomId: { in: rooms.map((r) => r.id) } },
        select: { roomId: true, status: true, lastReadAt: true },
      })
    : [];
  const memMap = new Map(memberships.map((m) => [m.roomId, m]));

  // Unread counts for the rooms this viewer has actively joined.
  const activeMems = memberships.filter((m) => m.status === "ACTIVE" && m.lastReadAt);
  const unreadPairs = await Promise.all(
    activeMems.map(async (m) => {
      const count = await prisma.chatMessage.count({
        where: {
          roomId: m.roomId,
          status: "PUBLISHED",
          createdAt: { gt: m.lastReadAt! },
          NOT: { authorId: opts.viewerId },
        },
      });
      return [m.roomId, count] as const;
    }),
  );
  const unreadMap = new Map(unreadPairs);

  return rooms.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    tier: r.tier,
    emoji: r.emoji,
    color: r.color,
    categoryId: r.categoryId,
    categoryName: r.category?.name ?? null,
    categorySort: r.category?.sortOrder ?? 9999,
    memberCount: r.memberCount,
    messageCount: r.messageCount,
    membership: memMap.get(r.id)?.status ?? null,
    isMember: memMap.get(r.id)?.status === "ACTIVE",
    unread: unreadMap.get(r.id) ?? 0,
  }));
}

export async function getRoomForUser(opts: { viewerId: string; slug: string }) {
  const r = await prisma.chatRoom.findUnique({
    where: { slug: opts.slug },
    include: { category: { select: { name: true } } },
  });
  if (!r) return null;

  const membership = await prisma.chatMembership.findUnique({
    where: { roomId_userId: { roomId: r.id, userId: opts.viewerId } },
  });
  const isMember = membership?.status === "ACTIVE";
  const banned = membership?.status === "BANNED";
  const isModerator = isMember && membership?.role === "MODERATOR";
  const canRead = r.tier === "PUBLIC" ? true : isMember;
  const canPost = r.status === "ACTIVE" && !banned && (r.tier === "PUBLIC" || isMember);

  const pinnedRows = canRead
    ? await prisma.chatMessage.findMany({
        where: { roomId: r.id, isPinned: true, status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, authorNameSnapshot: true, isAnonymous: true, body: true },
      })
    : [];
  const roomMask = await getMasker();

  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    rulesText: r.rulesText,
    tier: r.tier,
    status: r.status,
    emoji: r.emoji,
    color: r.color,
    allowAnonymous: r.allowAnonymous,
    slowModeSeconds: r.slowModeSeconds,
    categoryName: r.category?.name ?? null,
    memberCount: r.memberCount,
    messageCount: r.messageCount,
    membershipStatus: membership?.status ?? null,
    firstPostApproved: membership?.firstPostApproved ?? false,
    isMember,
    isModerator,
    banned,
    canRead,
    canPost,
    pinned: pinnedRows.map((p) => ({
      id: p.id,
      authorName: p.isAnonymous ? "Anonymous member" : p.authorNameSnapshot,
      body: roomMask(p.body),
    })),
  };
}

/* ── join / leave ────────────────────────────────────────────── */

export async function joinRoom(opts: { slug: string; viewerId: string; userName: string; userAvatar: string | null }) {
  const room = await prisma.chatRoom.findUnique({ where: { slug: opts.slug } });
  if (!room) throw new Error("Room not found");
  if (room.status !== "ACTIVE") throw new Error("This room is archived.");
  const existing = await prisma.chatMembership.findUnique({
    where: { roomId_userId: { roomId: room.id, userId: opts.viewerId } },
  });
  if (existing) {
    if (existing.status === "BANNED") throw new Error("You can't join this room.");
    return { joined: true };
  }
  await prisma.$transaction([
    prisma.chatMembership.create({
      data: {
        roomId: room.id,
        userId: opts.viewerId,
        userName: opts.userName,
        userAvatar: opts.userAvatar,
        status: "ACTIVE",
        firstPostApproved: room.tier === "PUBLIC",
        lastReadAt: new Date(),
      },
    }),
    prisma.chatRoom.update({ where: { id: room.id }, data: { memberCount: { increment: 1 } } }),
  ]);
  return { joined: true };
}

export async function leaveRoom(opts: { slug: string; viewerId: string }) {
  const room = await prisma.chatRoom.findUnique({ where: { slug: opts.slug }, select: { id: true } });
  if (!room) throw new Error("Room not found");
  const existing = await prisma.chatMembership.findUnique({
    where: { roomId_userId: { roomId: room.id, userId: opts.viewerId } },
    select: { id: true, status: true },
  });
  if (!existing) return { left: true };
  await prisma.$transaction([
    prisma.chatMembership.delete({ where: { id: existing.id } }),
    ...(existing.status === "ACTIVE"
      ? [prisma.chatRoom.update({ where: { id: room.id }, data: { memberCount: { decrement: 1 } } })]
      : []),
  ]);
  return { left: true };
}

/* ── members roster ──────────────────────────────────────────── */

export async function listRoomMembers(roomId: string) {
  const rows = await prisma.chatMembership.findMany({
    where: { roomId, status: "ACTIVE" },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    take: 200,
    select: { userId: true, userName: true, userAvatar: true, role: true },
  });
  return rows.map((m) => ({
    userId: m.userId,
    userName: m.userName,
    userAvatar: m.userAvatar,
    role: m.role,
  }));
}

/* ── messages ────────────────────────────────────────────────── */

export async function listMessages(opts: {
  roomId: string;
  viewerId: string | null;
  before?: string | null;
  after?: string | null;
  limit?: number;
  blockedIds?: string[];
}) {
  const limit = Math.min(50, Math.max(10, opts.limit ?? 30));
  const visible: Prisma.ChatMessageWhereInput = {
    roomId: opts.roomId,
    ...(opts.blockedIds && opts.blockedIds.length ? { authorId: { notIn: opts.blockedIds } } : {}),
    OR: [
      { status: "PUBLISHED" },
      ...(opts.viewerId ? [{ status: "PENDING" as const, authorId: opts.viewerId }] : []),
    ],
  };

  // Cursors are (createdAt, id), not createdAt alone — see @/lib/cursor
  // for what paging on the timestamp by itself was quietly dropping.
  if (opts.after) {
    const cursor = parseCursor(opts.after);
    const rows = await prisma.chatMessage.findMany({
      where: cursor ? { AND: [visible, newerThan(cursor)] } : visible,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 100,
      include: MSG_INCLUDE,
    });
    const maskA = await getMasker();
    const newest = rows[rows.length - 1];
    return {
      items: rows.map((m) => maskDto(mapMessage(m, opts.viewerId), maskA)),
      hasMoreBefore: false,
      beforeCursor: null,
      // Where the next poll should resume. The caller must use this
      // rather than re-deriving it from the last item's timestamp,
      // which is how the tie got lost in the first place.
      afterCursor: newest ? encodeCursor(newest.createdAt, newest.id) : opts.after,
    };
  }

  const beforeCur = parseCursor(opts.before);
  const where: Prisma.ChatMessageWhereInput = beforeCur
    ? { AND: [visible, olderThan(beforeCur)] }
    : visible;
  const rows = await prisma.chatMessage.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: MSG_INCLUDE,
  });
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const oldest = slice[slice.length - 1];
  const beforeCursor = hasMore && oldest ? encodeCursor(oldest.createdAt, oldest.id) : null;
  const mask = await getMasker();
  const items = [...slice].reverse().map((m) => maskDto(mapMessage(m, opts.viewerId), mask));
  // Same shape on both branches so callers don't have to narrow.
  return { items, hasMoreBefore: hasMore, beforeCursor, afterCursor: null };
}

export async function postMessage(opts: {
  slug: string;
  viewerId: string;
  userName: string;
  userAvatar: string | null;
  body: string;
  isAnonymous?: boolean;
  replyToId?: string | null;
  attachments?: Array<{ url: string; alt?: string | null }>;
  mentions?: string[];
}): Promise<{ message: ChatMessageDto; pending: boolean }> {
  const body = opts.body.trim();
  const attachments = (opts.attachments ?? [])
    .filter((a) => a && typeof a.url === "string" && a.url.length > 0)
    .slice(0, 4)
    .map((a) => ({ url: a.url, alt: a.alt ?? null }));
  if (!body && attachments.length === 0) throw new Error("Message can't be empty.");
  if (body.length > CHAT_BODY_MAX) throw new Error(`Message is too long (${body.length}/${CHAT_BODY_MAX}).`);

  const room = await prisma.chatRoom.findUnique({ where: { slug: opts.slug } });
  if (!room) throw new Error("Room not found");
  if (room.status !== "ACTIVE") throw new Error("This room is archived.");

  const anon = room.allowAnonymous ? !!opts.isAnonymous : false;

  let membership = await prisma.chatMembership.findUnique({
    where: { roomId_userId: { roomId: room.id, userId: opts.viewerId } },
  });
  if (membership?.status === "BANNED") throw new Error("You can't post in this room.");

  const isMod = membership?.role === "MODERATOR" && membership.status === "ACTIVE";

  // Slow mode (moderators exempt).
  if (room.slowModeSeconds > 0 && !isMod && membership?.lastPostAt) {
    const waited = (Date.now() - membership.lastPostAt.getTime()) / 1000;
    if (waited < room.slowModeSeconds) {
      const left = Math.ceil(room.slowModeSeconds - waited);
      throw new Error(`Slow mode is on — wait ${left}s before posting again.`);
    }
  }

  let pending = false;
  if (room.tier === "PUBLIC") {
    if (!membership) {
      membership = await prisma.chatMembership.create({
        data: {
          roomId: room.id,
          userId: opts.viewerId,
          userName: opts.userName,
          userAvatar: opts.userAvatar,
          status: "ACTIVE",
          firstPostApproved: true,
        },
      });
      await prisma.chatRoom.update({ where: { id: room.id }, data: { memberCount: { increment: 1 } } });
    }
  } else {
    if (!membership || membership.status !== "ACTIVE") throw new Error("Join this room to post.");
    // Messages post immediately (no first-post approval gate).
  }

  // Validate reply target belongs to this room.
  let replyToId: string | null = null;
  let parentAuthorId: string | null = null;
  if (opts.replyToId) {
    const parent = await prisma.chatMessage.findUnique({
      where: { id: opts.replyToId },
      select: { roomId: true, status: true, authorId: true },
    });
    if (parent && parent.roomId === room.id && parent.status === "PUBLISHED") {
      replyToId = opts.replyToId;
      parentAuthorId = parent.authorId;
    }
  }

  const created = await prisma.chatMessage.create({
    data: {
      roomId: room.id,
      authorId: opts.viewerId,
      authorNameSnapshot: opts.userName,
      authorAvatarSnapshot: opts.userAvatar,
      body,
      isAnonymous: anon,
      status: pending ? "PENDING" : "PUBLISHED",
      replyToId,
      attachments: attachments.length > 0 ? attachments : undefined,
    },
  });

  await prisma.chatMembership.update({
    where: { roomId_userId: { roomId: room.id, userId: opts.viewerId } },
    data: { lastPostAt: new Date() },
  });
  if (!pending) {
    await prisma.chatRoom.update({ where: { id: room.id }, data: { messageCount: { increment: 1 } } });

    const senderLabel = anon ? "Someone" : opts.userName;
    if (replyToId && parentAuthorId && parentAuthorId !== opts.viewerId) {
      await createUserNotification({
        userId: parentAuthorId,
        type: "CHAT_REPLY",
        title: `${senderLabel} replied to you`,
        body: body.slice(0, 120) || "Sent an image",
        actionUrl: `/chatrooms/${room.slug}`,
      });
    }
    if (opts.mentions?.length) {
      const ids = [...new Set(opts.mentions)].filter((id) => id && id !== opts.viewerId && id !== parentAuthorId);
      if (ids.length) {
        const mentioned = await prisma.chatMembership.findMany({
          where: { roomId: room.id, userId: { in: ids }, status: "ACTIVE" },
          select: { userId: true },
        });
        await createManyUserNotifications(mentioned.map((m) => m.userId), {
          type: "CHAT_MENTION",
          title: `${senderLabel} mentioned you in ${room.name}`,
          body: body.slice(0, 120),
          actionUrl: `/chatrooms/${room.slug}`,
        });
      }
    }
  }

  const full = await prisma.chatMessage.findUnique({ where: { id: created.id }, include: MSG_INCLUDE });
  const mask = await getMasker();
  return { message: maskDto(mapMessage(full as MsgRow, opts.viewerId), mask), pending };
}

export async function editOwnMessage(viewerId: string, messageId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message can't be empty.");
  if (trimmed.length > CHAT_BODY_MAX) throw new Error("Message is too long.");
  const m = await prisma.chatMessage.findUnique({ where: { id: messageId }, select: { authorId: true, status: true } });
  if (!m) throw new Error("Message not found");
  if (m.authorId !== viewerId) throw new Error("Not your message");
  if (m.status === "REMOVED") throw new Error("This message was removed.");
  await prisma.chatMessage.update({ where: { id: messageId }, data: { body: trimmed, editedAt: new Date() } });
  const full = await prisma.chatMessage.findUnique({ where: { id: messageId }, include: MSG_INCLUDE });
  const mask = await getMasker();
  return maskDto(mapMessage(full as MsgRow, viewerId), mask);
}

export async function deleteOwnMessage(viewerId: string, messageId: string) {
  const m = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { authorId: true, roomId: true, status: true },
  });
  if (!m) throw new Error("Message not found");
  if (m.authorId !== viewerId) throw new Error("Not your message");
  await prisma.$transaction([
    prisma.chatMessage.delete({ where: { id: messageId } }),
    ...(m.status === "PUBLISHED"
      ? [prisma.chatRoom.update({ where: { id: m.roomId }, data: { messageCount: { decrement: 1 } } })]
      : []),
  ]);
}

/* ── reactions ───────────────────────────────────────────────── */

export async function toggleReaction(viewerId: string, messageId: string, emoji: string) {
  if (!REACTION_EMOJIS.includes(emoji)) throw new Error("Unsupported reaction.");
  const msg = await prisma.chatMessage.findUnique({ where: { id: messageId }, select: { status: true, authorId: true, roomId: true } });
  if (!msg || msg.status === "REMOVED") throw new Error("Message not found");
  const existing = await prisma.chatMessageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId: viewerId, emoji } },
    select: { id: true },
  });
  if (existing) {
    await prisma.chatMessageReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.chatMessageReaction.create({ data: { messageId, userId: viewerId, emoji } });
    if (msg.authorId && msg.authorId !== viewerId) {
      const room = await prisma.chatRoom.findUnique({ where: { id: msg.roomId }, select: { slug: true } });
      await createUserNotification({
        userId: msg.authorId,
        type: "CHAT_REACTION",
        title: `Someone reacted ${emoji} to your message`,
        actionUrl: room ? `/chatrooms/${room.slug}` : null,
      });
    }
  }
  const count = await prisma.chatMessageReaction.count({ where: { messageId, emoji } });
  return { emoji, count, mine: !existing };
}

/* ── report a message ────────────────────────────────────────── */

export async function reportMessage(opts: {
  viewerId: string;
  messageId: string;
  reason: ReportReason;
  notes?: string;
}): Promise<{ duplicate: boolean }> {
  const msg = await prisma.chatMessage.findUnique({
    where: { id: opts.messageId },
    select: { id: true, roomId: true, authorNameSnapshot: true, isAnonymous: true, body: true },
  });
  if (!msg) throw new Error("Message not found");

  // `openMessageId` is set while the report is open and cleared on
  // resolve; the unique index on (reporterId, openMessageId) is what
  // actually stops a double-file. This lookup just makes the ordinary
  // "pressed it twice" case answer politely instead of throwing.
  const dupe = await prisma.chatMessageReport.findFirst({
    where: { openMessageId: opts.messageId, reporterId: opts.viewerId, status: "OPEN" },
    select: { id: true },
  });
  if (dupe) return { duplicate: true };

  try {
    await prisma.$transaction([
      prisma.chatMessageReport.create({
        data: {
          messageId: opts.messageId,
          roomId: msg.roomId,
          reporterId: opts.viewerId,
          reason: opts.reason,
          notes: opts.notes?.trim() || null,
          openMessageId: opts.messageId,
        },
      }),
      prisma.chatMessage.update({ where: { id: opts.messageId }, data: { reportCount: { increment: 1 } } }),
    ]);
  } catch (err) {
    if (
      typeof err === "object" && err !== null &&
      (err as { code?: string }).code === "P2002"
    ) {
      return { duplicate: true };
    }
    throw err;
  }

  const who = msg.isAnonymous ? "an anonymous member" : msg.authorNameSnapshot;
  const snippet = msg.body.replace(/\s+/g, " ").slice(0, 80).trim();
  await createForAllAdmins({
    type: "POST_REPORTED",
    title: "Chat message reported",
    message: `A message by ${who} was flagged: "${snippet}${msg.body.length > 80 ? "…" : ""}"`,
    actionUrl: "/admin/chatrooms",
  });
  return { duplicate: false };
}

export async function markRoomRead(viewerId: string, slug: string): Promise<void> {
  const room = await prisma.chatRoom.findUnique({ where: { slug }, select: { id: true } });
  if (!room) return;
  await prisma.chatMembership.updateMany({
    where: { roomId: room.id, userId: viewerId },
    data: { lastReadAt: new Date() },
  });
}

/* ── per-room moderator actions ──────────────────────────────── */

async function requireRoomMod(viewerId: string, messageId: string) {
  const msg = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { id: true, roomId: true, status: true, authorId: true },
  });
  if (!msg) throw new Error("Message not found");
  const mem = await prisma.chatMembership.findUnique({
    where: { roomId_userId: { roomId: msg.roomId, userId: viewerId } },
    select: { role: true, status: true },
  });
  if (!mem || mem.status !== "ACTIVE" || mem.role !== "MODERATOR") {
    throw new Error("Moderators only");
  }
  return msg;
}

export async function modPinMessage(viewerId: string, messageId: string, pin: boolean) {
  await requireRoomMod(viewerId, messageId);
  await prisma.chatMessage.update({ where: { id: messageId }, data: { isPinned: pin } });
}

export async function modRemoveMessage(viewerId: string, messageId: string) {
  const msg = await requireRoomMod(viewerId, messageId);
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.chatMessage.update({ where: { id: messageId }, data: { status: "REMOVED", isPinned: false } }),
  ];
  if (msg.status === "PUBLISHED") {
    ops.push(prisma.chatRoom.update({ where: { id: msg.roomId }, data: { messageCount: { decrement: 1 } } }));
  }
  await prisma.$transaction(ops);
}

export async function modApproveMessage(viewerId: string, messageId: string) {
  const msg = await requireRoomMod(viewerId, messageId);
  if (msg.status !== "PENDING") return;
  await prisma.$transaction([
    prisma.chatMessage.update({ where: { id: messageId }, data: { status: "PUBLISHED" } }),
    prisma.chatRoom.update({ where: { id: msg.roomId }, data: { messageCount: { increment: 1 } } }),
    ...(msg.authorId
      ? [
          prisma.chatMembership.updateMany({
            where: { roomId: msg.roomId, userId: msg.authorId },
            data: { firstPostApproved: true },
          }),
        ]
      : []),
  ]);
}


/* ── crisis panic ────────────────────────────────────────────── */

export async function panicAlert(opts: { viewerId: string; slug: string }) {
  const room = await prisma.chatRoom.findUnique({
    where: { slug: opts.slug },
    select: { id: true, name: true, slug: true },
  });
  if (!room) throw new Error("Room not found");
  const mods = await prisma.chatMembership.findMany({
    where: { roomId: room.id, role: "MODERATOR", status: "ACTIVE" },
    select: { userId: true },
  });
  await createManyUserNotifications(
    mods.map((m) => m.userId).filter((id) => id !== opts.viewerId),
    {
      type: "CRISIS_ALERT",
      title: `Crisis alert in ${room.name}`,
      body: "A member asked for urgent help. Please check in on the room.",
      actionUrl: `/chatrooms/${room.slug}`,
    },
  );
  return { moderatorsAlerted: mods.length };
}
