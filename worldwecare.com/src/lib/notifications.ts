/**
 * User-facing notification system. Powers the /notifications page and
 * the sidebar bell. Creation helpers are best-effort (never throw
 * into the caller's transaction).
 */

import type { Prisma, UserNotifType } from "@prisma/client";
import { prisma } from "./db";

export async function createUserNotification(input: {
  userId: string;
  type: UserNotifType;
  title: string;
  body?: string | null;
  actionUrl?: string | null;
}): Promise<void> {
  if (!input.userId) return;
  try {
    await prisma.userNotification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        actionUrl: input.actionUrl ?? null,
      },
    });
  } catch (err) {
    console.warn("[notifications] create failed:", err);
  }
}

export async function createManyUserNotifications(
  userIds: string[],
  base: { type: UserNotifType; title: string; body?: string | null; actionUrl?: string | null },
): Promise<void> {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (!unique.length) return;
  try {
    await prisma.userNotification.createMany({
      data: unique.map((userId) => ({
        userId,
        type: base.type,
        title: base.title,
        body: base.body ?? null,
        actionUrl: base.actionUrl ?? null,
      })),
    });
  } catch (err) {
    console.warn("[notifications] createMany failed:", err);
  }
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.userNotification.count({ where: { userId, isRead: false } });
}

export interface NotificationDto {
  id: string;
  type: UserNotifType;
  title: string;
  body: string | null;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export async function listNotifications(
  userId: string,
  opts: { cursor?: string | null; limit?: number },
): Promise<{ items: NotificationDto[]; nextCursor: string | null; unread: number }> {
  const limit = Math.min(50, Math.max(10, opts.limit ?? 25));
  const where: Prisma.UserNotificationWhereInput = { userId };
  if (opts.cursor) {
    const idx = opts.cursor.lastIndexOf("_");
    const iso = opts.cursor.slice(0, idx);
    const id = opts.cursor.slice(idx + 1);
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime()) && id) {
      where.OR = [{ createdAt: { lt: d } }, { createdAt: d, id: { lt: id } }];
    }
  }
  const rows = await prisma.userNotification.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const last = slice[slice.length - 1];
  const unread = await unreadCount(userId);
  return {
    items: slice.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      actionUrl: n.actionUrl,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })),
    nextCursor: hasMore && last ? `${last.createdAt.toISOString()}_${last.id}` : null,
    unread,
  };
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
  await prisma.userNotification.updateMany({
    where: { userId, isRead: false, ...(ids && ids.length ? { id: { in: ids } } : {}) },
    data: { isRead: true },
  });
}
