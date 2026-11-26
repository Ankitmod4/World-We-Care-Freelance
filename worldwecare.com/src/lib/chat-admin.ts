/**
 * Admin-side chatroom management — full control surface:
 *   • categories (create / rename / reorder / delete)
 *   • rooms (create / edit / archive / delete, any tier)
 *   • members (approve first post, promote/demote moderator, ban, remove)
 *   • messages (approve pending, pin, remove/restore)
 *
 * Author identity on messages/members is stored as scalar ids +
 * snapshots (see schema), so these helpers never join the User table.
 */

import type { Prisma, ChatTier, ChatRoomStatus, ChatMemberRole, ChatMemberStatus } from "@prisma/client";
import { prisma } from "./db";
import { slugify } from "./geography-admin";

/* ── slugs ───────────────────────────────────────────────────── */

async function uniqueRoomSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "room";
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await prisma.chatRoom.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

async function uniqueCategorySlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "category";
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await prisma.chatCategory.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

/* ── categories ──────────────────────────────────────────────── */

export async function listCategories() {
  const rows = await prisma.chatCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { rooms: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    sortOrder: c.sortOrder,
    roomCount: c._count.rooms,
  }));
}

export async function createCategory(input: { name: string; sortOrder?: number }) {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  const slug = await uniqueCategorySlug(name);
  return prisma.chatCategory.create({
    data: { name, slug, sortOrder: input.sortOrder ?? 0 },
  });
}

export async function updateCategory(
  id: string,
  input: { name?: string; sortOrder?: number },
) {
  const data: Prisma.ChatCategoryUpdateInput = {};
  if (typeof input.name === "string") {
    const name = input.name.trim();
    if (!name) throw new Error("Name is required");
    data.name = name;
    data.slug = await uniqueCategorySlug(name, id);
  }
  if (typeof input.sortOrder === "number") data.sortOrder = input.sortOrder;
  return prisma.chatCategory.update({ where: { id }, data });
}

export async function deleteCategory(id: string) {
  // Rooms fall back to "uncategorised" via onDelete: SetNull.
  await prisma.chatCategory.delete({ where: { id } });
}

/* ── rooms ───────────────────────────────────────────────────── */

export interface RoomInput {
  name: string;
  slug?: string;
  description?: string | null;
  tier?: ChatTier;
  status?: ChatRoomStatus;
  categoryId?: string | null;
  countryId?: string | null;
  emoji?: string | null;
  color?: string | null;
  allowAnonymous?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
  slowModeSeconds?: number;
  rulesText?: string | null;
}

export async function listRooms(opts: {
  q?: string;
  status?: "all" | "active" | "archived";
  tier?: ChatTier | "all";
  categoryId?: string;
}) {
  const where: Prisma.ChatRoomWhereInput = {};
  if (opts.status === "active") where.status = "ACTIVE";
  else if (opts.status === "archived") where.status = "ARCHIVED";
  if (opts.tier && opts.tier !== "all") where.tier = opts.tier;
  if (opts.categoryId) where.categoryId = opts.categoryId;
  if (opts.q && opts.q.trim()) {
    where.OR = [
      { name: { contains: opts.q.trim() } },
      { description: { contains: opts.q.trim() } },
    ];
  }

  const rows = await prisma.chatRoom.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      category: { select: { id: true, name: true } },
      _count: { select: { memberships: true, messages: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    tier: r.tier,
    status: r.status,
    categoryId: r.categoryId,
    categoryName: r.category?.name ?? null,
    emoji: r.emoji,
    color: r.color,
    allowAnonymous: r.allowAnonymous,
    isFeatured: r.isFeatured,
    sortOrder: r.sortOrder,
    memberCount: r.memberCount,
    messageCount: r.messageCount,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getRoomAdmin(id: string) {
  const r = await prisma.chatRoom.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true } } },
  });
  if (!r) return null;
  const [pendingMessages, pendingMembers] = await Promise.all([
    prisma.chatMessage.count({ where: { roomId: id, status: "PENDING" } }),
    prisma.chatMembership.count({ where: { roomId: id, status: "PENDING" } }),
  ]);
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    tier: r.tier,
    status: r.status,
    categoryId: r.categoryId,
    categoryName: r.category?.name ?? null,
    countryId: r.countryId,
    emoji: r.emoji,
    color: r.color,
    allowAnonymous: r.allowAnonymous,
    isFeatured: r.isFeatured,
    sortOrder: r.sortOrder,
    slowModeSeconds: r.slowModeSeconds,
    rulesText: r.rulesText,
    memberCount: r.memberCount,
    messageCount: r.messageCount,
    pendingMessages,
    pendingMembers,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function createRoom(input: RoomInput, adminId: string) {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");
  const slug = await uniqueRoomSlug(input.slug || name);
  return prisma.chatRoom.create({
    data: {
      name,
      slug,
      description: input.description?.trim() || null,
      tier: input.tier ?? "PUBLIC",
      status: input.status ?? "ACTIVE",
      categoryId: input.categoryId || null,
      countryId: input.countryId || null,
      emoji: input.emoji?.trim() || null,
      color: input.color?.trim() || null,
      allowAnonymous: input.allowAnonymous ?? true,
      isFeatured: input.isFeatured ?? false,
      sortOrder: input.sortOrder ?? 0,
      slowModeSeconds: input.slowModeSeconds ?? 0,
      rulesText: input.rulesText?.trim() || null,
      createdByAdminId: adminId,
    },
  });
}

export async function updateRoom(id: string, input: RoomInput) {
  const data: Prisma.ChatRoomUpdateInput = {};
  if (typeof input.name === "string") {
    const name = input.name.trim();
    if (!name) throw new Error("Name is required");
    data.name = name;
  }
  if (input.slug !== undefined) data.slug = await uniqueRoomSlug(input.slug || input.name || "room", id);
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.tier !== undefined) data.tier = input.tier;
  if (input.status !== undefined) data.status = input.status;
  if (input.categoryId !== undefined)
    data.category = input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true };
  if (input.countryId !== undefined) data.countryId = input.countryId || null;
  if (input.emoji !== undefined) data.emoji = input.emoji?.trim() || null;
  if (input.color !== undefined) data.color = input.color?.trim() || null;
  if (input.allowAnonymous !== undefined) data.allowAnonymous = input.allowAnonymous;
  if (input.isFeatured !== undefined) data.isFeatured = input.isFeatured;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.slowModeSeconds !== undefined) data.slowModeSeconds = Math.max(0, input.slowModeSeconds);
  if (input.rulesText !== undefined) data.rulesText = input.rulesText?.trim() || null;
  return prisma.chatRoom.update({ where: { id }, data });
}

export async function deleteRoom(id: string) {
  await prisma.chatRoom.delete({ where: { id } });
}

/* ── members ─────────────────────────────────────────────────── */

export async function listMembers(roomId: string, status?: ChatMemberStatus | "all") {
  const where: Prisma.ChatMembershipWhereInput = { roomId };
  if (status && status !== "all") where.status = status;
  const rows = await prisma.chatMembership.findMany({
    where,
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });
  return rows.map((m) => ({
    id: m.id,
    userId: m.userId,
    userName: m.userName,
    userAvatar: m.userAvatar,
    role: m.role,
    status: m.status,
    firstPostApproved: m.firstPostApproved,
    joinedAt: m.joinedAt.toISOString(),
  }));
}

export async function updateMember(
  memberId: string,
  input: { role?: ChatMemberRole; status?: ChatMemberStatus; approveFirstPost?: boolean; reason?: string | null },
) {
  const data: Prisma.ChatMembershipUpdateInput = {};
  if (input.role !== undefined) data.role = input.role;
  if (input.status !== undefined) {
    data.status = input.status;
    data.bannedReason = input.status === "BANNED" ? input.reason ?? null : null;
  }
  if (input.approveFirstPost !== undefined) data.firstPostApproved = input.approveFirstPost;
  return prisma.chatMembership.update({ where: { id: memberId }, data });
}

export async function removeMember(memberId: string) {
  const m = await prisma.chatMembership.findUnique({
    where: { id: memberId },
    select: { roomId: true, status: true },
  });
  if (!m) throw new Error("Member not found");
  await prisma.$transaction([
    prisma.chatMembership.delete({ where: { id: memberId } }),
    ...(m.status === "ACTIVE"
      ? [prisma.chatRoom.update({ where: { id: m.roomId }, data: { memberCount: { decrement: 1 } } })]
      : []),
  ]);
}

/* ── messages ────────────────────────────────────────────────── */

export async function listMessagesAdmin(
  roomId: string,
  opts: { status?: "all" | "published" | "pending" | "removed" | "reported"; limit?: number },
) {
  const where: Prisma.ChatMessageWhereInput = { roomId };
  if (opts.status === "published") where.status = "PUBLISHED";
  else if (opts.status === "pending") where.status = "PENDING";
  else if (opts.status === "removed") where.status = "REMOVED";
  else if (opts.status === "reported") where.reportCount = { gt: 0 };
  const rows = await prisma.chatMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(200, Math.max(10, opts.limit ?? 100)),
  });
  return rows.map((m) => ({
    id: m.id,
    authorId: m.authorId,
    authorName: m.authorNameSnapshot,
    isAnonymous: m.isAnonymous,
    body: m.body,
    status: m.status,
    isPinned: m.isPinned,
    reportCount: m.reportCount,
    removedReason: m.removedReason,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function moderateMessage(
  messageId: string,
  action: "approve" | "remove" | "restore" | "pin" | "unpin",
  reason?: string | null,
) {
  const msg = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { id: true, roomId: true, status: true },
  });
  if (!msg) throw new Error("Message not found");

  if (action === "pin" || action === "unpin") {
    return prisma.chatMessage.update({
      where: { id: messageId },
      data: { isPinned: action === "pin" },
    });
  }

  if (action === "remove") {
    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.chatMessage.update({
        where: { id: messageId },
        data: { status: "REMOVED", removedReason: reason ?? null, isPinned: false },
      }),
    ];
    if (msg.status === "PUBLISHED") {
      ops.push(prisma.chatRoom.update({ where: { id: msg.roomId }, data: { messageCount: { decrement: 1 } } }));
    }
    ops.push(
      prisma.chatMessageReport.updateMany({
        where: { messageId, status: "OPEN" },
        // openMessageId: null releases the unique key so the same
        // reporter isn't barred from ever flagging this message again.
        data: { status: "RESOLVED", resolvedAt: new Date(), openMessageId: null },
      }),
    );
    await prisma.$transaction(ops);
    return;
  }

  // approve (PENDING → PUBLISHED) or restore (REMOVED → PUBLISHED)
  const wasCounted = msg.status === "PUBLISHED";
  await prisma.$transaction([
    prisma.chatMessage.update({
      where: { id: messageId },
      data: { status: "PUBLISHED", removedReason: null },
    }),
    ...(!wasCounted
      ? [prisma.chatRoom.update({ where: { id: msg.roomId }, data: { messageCount: { increment: 1 } } })]
      : []),
  ]);
}

export async function hardDeleteMessage(messageId: string) {
  const m = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { roomId: true, status: true },
  });
  if (!m) throw new Error("Message not found");
  await prisma.$transaction([
    prisma.chatMessage.delete({ where: { id: messageId } }),
    ...(m.status === "PUBLISHED"
      ? [prisma.chatRoom.update({ where: { id: m.roomId }, data: { messageCount: { decrement: 1 } } })]
      : []),
  ]);
}
