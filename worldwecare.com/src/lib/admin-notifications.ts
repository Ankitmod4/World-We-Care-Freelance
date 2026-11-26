/**
 * Admin notifications — fan-out inbox.
 *
 * `createForAllAdmins` writes one row per active admin so read state
 * stays per-person. Best-effort — a failure here must never block
 * whatever originating action (signup, ban, etc) triggered it. We
 * catch and log rather than throw.
 *
 * `readable` returns the shape the client-side bell + dropdown
 * consume: unread count + last N rows.
 */

import type { AdminNotifType } from "@prisma/client";
import { prisma } from "./db";

export interface NotifInput {
  type: AdminNotifType;
  title: string;
  message?: string;
  actionUrl?: string;
}

export async function createForAllAdmins(input: NotifInput): Promise<void> {
  try {
    const admins = await prisma.adminUser.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    if (admins.length === 0) return;
    await prisma.adminNotification.createMany({
      data: admins.map((a) => ({
        adminId: a.id,
        type: input.type,
        title: input.title,
        message: input.message ?? null,
        actionUrl: input.actionUrl ?? null,
      })),
    });
  } catch (err) {
    console.warn("[admin-notifications] fan-out failed:", err);
  }
}

/**
 * Optional variant that targets a specific admin. Useful for
 * "admin A did X to record B — notify admin B's owner" flows.
 */
export async function createForAdmin(
  adminId: string,
  input: NotifInput,
): Promise<void> {
  try {
    await prisma.adminNotification.create({
      data: {
        adminId,
        type: input.type,
        title: input.title,
        message: input.message ?? null,
        actionUrl: input.actionUrl ?? null,
      },
    });
  } catch (err) {
    console.warn("[admin-notifications] direct create failed:", err);
  }
}

// ── Reads used by the bell / dropdown ───────────────────────────

export interface NotifDto {
  id: string;
  type: string;
  title: string;
  message: string | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface BellPayload {
  unread: number;
  items: NotifDto[];
}

/**
 * Latest N notifications + unread count for the bell dropdown.
 * Kept small so the SSE stream can send this on every tick without
 * bloating the wire.
 */
export async function getBellPayload(
  adminId: string,
  limit = 20,
): Promise<BellPayload> {
  const [items, unread] = await Promise.all([
    prisma.adminNotification.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.adminNotification.count({
      where: { adminId, readAt: null },
    }),
  ]);
  return {
    unread,
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      actionUrl: n.actionUrl,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

/** Mark either specific ids or every unread row as read. */
export async function markRead(
  adminId: string,
  ids: string[] | "all",
): Promise<number> {
  const now = new Date();
  if (ids === "all") {
    const res = await prisma.adminNotification.updateMany({
      where: { adminId, readAt: null },
      data: { readAt: now },
    });
    return res.count;
  }
  if (ids.length === 0) return 0;
  const res = await prisma.adminNotification.updateMany({
    where: { adminId, id: { in: ids }, readAt: null },
    data: { readAt: now },
  });
  return res.count;
}
