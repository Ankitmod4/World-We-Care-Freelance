/**
 * Admin-side user management helpers.
 *
 * Centralizes list, get-with-counts, update, ban, unban, activate,
 * deactivate, delete, and admin-create so the API routes are thin
 * and every mutation goes through the same audit-log path.
 *
 * All mutations expect an `adminId` — that's what gets recorded in
 * AdminActionLog. Callers get an object shaped for the admin UI (no
 * password hashes, dates as ISO strings, counts pre-joined).
 */

import { AdminAction, type Prisma, type User } from "@prisma/client";
import { prisma } from "./db";
import { hashPassword } from "./password";
import { logAdminAction } from "./admin-action-log";
import { logUserActivity } from "./user-activity";

export interface AdminUserDto {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  anonymousByDefault: boolean;
  isActive: boolean;
  bannedAt: string | null;
  banReason: string | null;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  activityCount: number;
}

function toDto(
  u: User & { _count?: { activities: number } },
): AdminUserDto {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    anonymousByDefault: u.anonymousByDefault,
    isActive: u.isActive,
    bannedAt: u.bannedAt?.toISOString() ?? null,
    banReason: u.banReason,
    emailVerifiedAt: u.emailVerifiedAt?.toISOString() ?? null,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    activityCount: u._count?.activities ?? 0,
  };
}

// ── List ──────────────────────────────────────────────────────────

export interface ListOptions {
  q?: string;
  status?: "all" | "active" | "inactive" | "banned" | "unverified";
  sort?: "created_desc" | "created_asc" | "last_login" | "name";
  page: number;
  perPage: number;
}

const MAX_PER_PAGE = 100;

export async function listUsersAdmin(opts: ListOptions): Promise<{
  items: AdminUserDto[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}> {
  const q = (opts.q ?? "").trim();
  const status = opts.status ?? "all";
  const sort = opts.sort ?? "created_desc";
  const page = Math.max(1, opts.page);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(5, opts.perPage));

  const where: Prisma.UserWhereInput = {};
  if (q) {
    where.OR = [
      { email: { contains: q } },
      { displayName: { contains: q } },
    ];
  }
  if (status === "active") {
    where.isActive = true;
    where.bannedAt = null;
  } else if (status === "inactive") {
    where.isActive = false;
  } else if (status === "banned") {
    where.bannedAt = { not: null };
  } else if (status === "unverified") {
    where.emailVerifiedAt = null;
  }

  const orderBy: Prisma.UserOrderByWithRelationInput =
    sort === "created_asc"
      ? { createdAt: "asc" }
      : sort === "last_login"
        ? { lastLoginAt: "desc" }
        : sort === "name"
          ? { displayName: "asc" }
          : { createdAt: "desc" };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        _count: { select: { activities: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: rows.map((r) => toDto(r)),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

// ── Read ──────────────────────────────────────────────────────────

export async function getUserAdmin(id: string): Promise<AdminUserDto | null> {
  const row = await prisma.user.findUnique({
    where: { id },
    include: {
      _count: { select: { activities: true } },
    },
  });
  return row ? toDto(row) : null;
}

// ── Update ────────────────────────────────────────────────────────

export interface UpdateInput {
  displayName?: string;
  email?: string;
  avatarUrl?: string | null;
  anonymousByDefault?: boolean;
}

export async function updateUserAdmin(
  adminId: string,
  id: string,
  input: UpdateInput,
): Promise<AdminUserDto> {
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) throw new Error("User not found");

  const data: Prisma.UserUpdateInput = {};
  const diff: Record<string, { from: unknown; to: unknown }> = {};

  if (input.displayName !== undefined && input.displayName !== before.displayName) {
    data.displayName = input.displayName;
    diff.displayName = { from: before.displayName, to: input.displayName };
  }
  if (input.email !== undefined && input.email !== before.email) {
    data.email = input.email.trim().toLowerCase();
    // Changing the email invalidates prior verification.
    data.emailVerifiedAt = null;
    diff.email = { from: before.email, to: input.email };
  }
  if (input.avatarUrl !== undefined && input.avatarUrl !== before.avatarUrl) {
    data.avatarUrl = input.avatarUrl;
    diff.avatarUrl = { from: before.avatarUrl, to: input.avatarUrl };
  }
  if (
    input.anonymousByDefault !== undefined &&
    input.anonymousByDefault !== before.anonymousByDefault
  ) {
    data.anonymousByDefault = input.anonymousByDefault;
    diff.anonymousByDefault = {
      from: before.anonymousByDefault,
      to: input.anonymousByDefault,
    };
  }

  if (Object.keys(diff).length === 0) {
    // No-op — return the current row without writing an empty log entry.
    const r = await prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { activities: true } } },
    });
    return toDto(r!);
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    include: { _count: { select: { activities: true } } },
  });

  await logAdminAction({
    adminId,
    action: AdminAction.USER_UPDATED,
    targetUserId: id,
    meta: diff as unknown as Prisma.InputJsonValue,
    userFacingMessage: "Profile updated by an admin.",
  });

  return toDto(updated);
}

// ── Activate / deactivate ────────────────────────────────────────

export async function setActiveAdmin(
  adminId: string,
  id: string,
  active: boolean,
  reason?: string,
): Promise<AdminUserDto> {
  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: active },
    include: { _count: { select: { activities: true } } },
  });
  await logAdminAction({
    adminId,
    action: active ? AdminAction.USER_ACTIVATED : AdminAction.USER_DEACTIVATED,
    targetUserId: id,
    reason,
    userFacingMessage: active
      ? "Your account was reactivated."
      : "Your account was deactivated by an admin.",
  });
  return toDto(updated);
}

// ── Ban / unban ──────────────────────────────────────────────────

export async function banUserAdmin(
  adminId: string,
  id: string,
  reason: string,
): Promise<AdminUserDto> {
  const updated = await prisma.user.update({
    where: { id },
    data: {
      bannedAt: new Date(),
      banReason: reason,
      // Banning implies the account can't be used — flip isActive
      // too so downstream auth checks stay simple.
      isActive: false,
    },
    include: { _count: { select: { activities: true } } },
  });
  await logAdminAction({
    adminId,
    action: AdminAction.USER_BANNED,
    targetUserId: id,
    reason,
    userFacingMessage: "Your account was banned.",
  });
  return toDto(updated);
}

export async function unbanUserAdmin(
  adminId: string,
  id: string,
  reason?: string,
): Promise<AdminUserDto> {
  const updated = await prisma.user.update({
    where: { id },
    data: {
      bannedAt: null,
      banReason: null,
      isActive: true,
    },
    include: { _count: { select: { activities: true } } },
  });
  await logAdminAction({
    adminId,
    action: AdminAction.USER_UNBANNED,
    targetUserId: id,
    reason,
    userFacingMessage: "Your ban was lifted.",
  });
  return toDto(updated);
}

// ── Delete ────────────────────────────────────────────────────────

export async function deleteUserAdmin(
  adminId: string,
  id: string,
  reason?: string,
): Promise<void> {
  const before = await prisma.user.findUnique({
    where: { id },
    select: { email: true, displayName: true },
  });
  if (!before) return;
  await prisma.user.delete({ where: { id } });
  await logAdminAction({
    adminId,
    action: AdminAction.USER_DELETED,
    // targetUserId is null now — the row is gone. Stash the id +
    // identifying info in meta so the audit trail is still legible.
    targetUserId: null,
    meta: {
      deletedUserId: id,
      email: before.email,
      displayName: before.displayName,
    } as unknown as Prisma.InputJsonValue,
    reason,
  });
}

// ── Admin-create ─────────────────────────────────────────────────

export async function createUserAdmin(
  adminId: string,
  input: {
    email: string;
    displayName: string;
    password: string;
    emailVerified?: boolean;
  },
): Promise<AdminUserDto> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("A user with that email already exists");
  }
  const passwordHash = await hashPassword(input.password);
  const row = await prisma.user.create({
    data: {
      email,
      displayName: input.displayName.trim(),
      passwordHash,
      emailVerifiedAt: input.emailVerified ? new Date() : null,
    },
    include: { _count: { select: { activities: true } } },
  });
  await logAdminAction({
    adminId,
    action: AdminAction.USER_CREATED,
    targetUserId: row.id,
    meta: { email, displayName: input.displayName } as unknown as Prisma.InputJsonValue,
  });
  await logUserActivity({
    userId: row.id,
    type: "SIGNED_UP",
    message: "Account created by an admin.",
  });
  return toDto(row);
}

// ── Activity feed ────────────────────────────────────────────────

export interface ActivityDto {
  id: string;
  type: string;
  message: string;
  meta: Prisma.JsonValue | null;
  createdAt: string;
}

export async function getUserActivityAdmin(
  userId: string,
  page: number,
  perPage: number,
): Promise<{
  items: ActivityDto[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}> {
  const p = Math.max(1, page);
  const pp = Math.min(100, Math.max(5, perPage));
  const [rows, total] = await Promise.all([
    prisma.userActivity.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (p - 1) * pp,
      take: pp,
    }),
    prisma.userActivity.count({ where: { userId } }),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      message: r.message,
      meta: r.meta,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    page: p,
    perPage: pp,
    totalPages: Math.max(1, Math.ceil(total / pp)),
  };
}

// ── Admin-action feed for a user ─────────────────────────────────

export interface AdminActionDto {
  id: string;
  action: string;
  reason: string | null;
  meta: Prisma.JsonValue | null;
  createdAt: string;
  admin: {
    id: string;
    displayName: string;
    email: string;
  } | null;
}

export async function getAdminActionsForUser(
  userId: string,
  page: number,
  perPage: number,
): Promise<{
  items: AdminActionDto[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}> {
  const p = Math.max(1, page);
  const pp = Math.min(100, Math.max(5, perPage));
  const [rows, total] = await Promise.all([
    prisma.adminActionLog.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: "desc" },
      skip: (p - 1) * pp,
      take: pp,
      include: {
        admin: {
          select: { id: true, displayName: true, email: true },
        },
      },
    }),
    prisma.adminActionLog.count({ where: { targetUserId: userId } }),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      action: r.action,
      reason: r.reason,
      meta: r.meta,
      createdAt: r.createdAt.toISOString(),
      admin: r.admin
        ? {
            id: r.admin.id,
            displayName: r.admin.displayName,
            email: r.admin.email,
          }
        : null,
    })),
    total,
    page: p,
    perPage: pp,
    totalPages: Math.max(1, Math.ceil(total / pp)),
  };
}
