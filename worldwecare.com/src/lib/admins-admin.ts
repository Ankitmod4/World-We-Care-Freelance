/**
 * Admin-team management helpers.
 *
 * Guards baked in — the API layer stays thin because these functions
 * enforce the safety rules:
 *   • No one can delete or deactivate themselves.
 *   • The LAST active OWNER can't be demoted, deactivated, or
 *     deleted. There must always be at least one owner who can
 *     regain control.
 *
 * Every mutation records an AdminActionLog entry (targetUserId is
 * null for admin-on-admin actions — meta.adminTargetId carries the
 * id instead). This keeps admin management auditable next to user
 * management.
 */

import type { AdminRole, AdminUser, Prisma } from "@prisma/client";
import { AdminAction } from "@prisma/client";
import { prisma } from "./db";
import { hashPassword } from "./password";
import { logAdminAction } from "./admin-action-log";

export interface AdminDto {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toDto(a: AdminUser): AdminDto {
  return {
    id: a.id,
    email: a.email,
    displayName: a.displayName,
    role: a.role,
    isActive: a.isActive,
    lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

// ── Owner safety ──────────────────────────────────────────────────

/** How many ACTIVE owners exist right now, excluding a specific id
 *  (so we can ask "would this update leave us with zero owners?"). */
async function countActiveOwnersExcluding(exceptId?: string): Promise<number> {
  return prisma.adminUser.count({
    where: {
      role: "OWNER",
      isActive: true,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
}

/** Throws when the change would leave zero active owners. */
async function assertNotLastOwner(id: string, kind: string): Promise<void> {
  const remaining = await countActiveOwnersExcluding(id);
  if (remaining === 0) {
    throw new Error(
      `Can't ${kind} the last active owner. Promote someone else first.`,
    );
  }
}

// ── List / read ───────────────────────────────────────────────────

const MAX_PER_PAGE = 100;
export type StatusFilter = "all" | "active" | "inactive";
export type RoleFilter = "all" | AdminRole;

export interface ListOptions {
  q?: string;
  status?: StatusFilter;
  role?: RoleFilter;
  page: number;
  perPage: number;
}

export async function listAdmins(opts: ListOptions): Promise<{
  items: AdminDto[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}> {
  const q = (opts.q ?? "").trim();
  const status = opts.status ?? "all";
  const role = opts.role ?? "all";
  const page = Math.max(1, opts.page);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(5, opts.perPage));

  const where: Prisma.AdminUserWhereInput = {};
  if (q) {
    where.OR = [
      { email: { contains: q } },
      { displayName: { contains: q } },
    ];
  }
  if (status === "active") where.isActive = true;
  else if (status === "inactive") where.isActive = false;
  if (role !== "all") where.role = role;

  const [rows, total] = await Promise.all([
    prisma.adminUser.findMany({
      where,
      orderBy: [
        // Owners first (highest privilege), then Admins, then Moderators.
        // Inside each role, alphabetical.
        { role: "asc" },
        { displayName: "asc" },
      ],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.adminUser.count({ where }),
  ]);

  return {
    items: rows.map(toDto),
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getAdmin(id: string): Promise<AdminDto | null> {
  const row = await prisma.adminUser.findUnique({ where: { id } });
  return row ? toDto(row) : null;
}

// ── Create (invite) ───────────────────────────────────────────────

export interface CreateInput {
  email: string;
  displayName: string;
  password: string;
  role: AdminRole;
}

export async function createAdmin(
  actorId: string,
  input: CreateInput,
): Promise<AdminDto> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) throw new Error("An admin with that email already exists.");

  const passwordHash = await hashPassword(input.password);
  const row = await prisma.adminUser.create({
    data: {
      email,
      displayName: input.displayName.trim(),
      passwordHash,
      role: input.role,
    },
  });

  await logAdminAction({
    adminId: actorId,
    action: AdminAction.USER_CREATED,
    meta: {
      kind: "admin",
      adminTargetId: row.id,
      email: row.email,
      role: row.role,
    } as unknown as Prisma.InputJsonValue,
  });

  return toDto(row);
}

// ── Update ────────────────────────────────────────────────────────

export interface UpdateInput {
  displayName?: string;
  email?: string;
  role?: AdminRole;
}

export async function updateAdmin(
  actorId: string,
  id: string,
  input: UpdateInput,
): Promise<AdminDto> {
  const before = await prisma.adminUser.findUnique({ where: { id } });
  if (!before) throw new Error("Admin not found");

  const data: Prisma.AdminUserUpdateInput = {};
  const diff: Record<string, { from: unknown; to: unknown }> = {};

  if (input.displayName !== undefined && input.displayName !== before.displayName) {
    data.displayName = input.displayName.trim();
    diff.displayName = { from: before.displayName, to: input.displayName };
  }
  if (input.email !== undefined && input.email.trim().toLowerCase() !== before.email) {
    data.email = input.email.trim().toLowerCase();
    diff.email = { from: before.email, to: input.email };
  }
  if (input.role !== undefined && input.role !== before.role) {
    // Guard — demoting an owner would need to leave at least one
    // other active owner behind.
    if (before.role === "OWNER" && input.role !== "OWNER") {
      await assertNotLastOwner(id, "demote");
    }
    data.role = input.role;
    diff.role = { from: before.role, to: input.role };
  }

  if (Object.keys(diff).length === 0) return toDto(before);

  const updated = await prisma.adminUser.update({ where: { id }, data });
  await logAdminAction({
    adminId: actorId,
    action: AdminAction.USER_UPDATED,
    meta: {
      kind: "admin",
      adminTargetId: id,
      diff,
    } as unknown as Prisma.InputJsonValue,
  });
  return toDto(updated);
}

// ── Activate / deactivate ────────────────────────────────────────

export async function setActive(
  actorId: string,
  id: string,
  active: boolean,
  reason?: string,
): Promise<AdminDto> {
  if (actorId === id && !active) {
    throw new Error("You can't deactivate your own account.");
  }
  if (!active) {
    const before = await prisma.adminUser.findUnique({
      where: { id },
      select: { role: true, isActive: true },
    });
    if (before?.role === "OWNER" && before.isActive) {
      await assertNotLastOwner(id, "deactivate");
    }
  }

  const updated = await prisma.adminUser.update({
    where: { id },
    data: { isActive: active },
  });
  await logAdminAction({
    adminId: actorId,
    action: active ? AdminAction.USER_ACTIVATED : AdminAction.USER_DEACTIVATED,
    reason,
    meta: {
      kind: "admin",
      adminTargetId: id,
    } as unknown as Prisma.InputJsonValue,
  });
  return toDto(updated);
}

// ── Delete ────────────────────────────────────────────────────────

export async function deleteAdmin(
  actorId: string,
  id: string,
  reason?: string,
): Promise<void> {
  if (actorId === id) {
    throw new Error("You can't delete your own account.");
  }
  const before = await prisma.adminUser.findUnique({
    where: { id },
    select: { role: true, isActive: true, email: true, displayName: true },
  });
  if (!before) return;
  if (before.role === "OWNER" && before.isActive) {
    await assertNotLastOwner(id, "delete");
  }
  await prisma.adminUser.delete({ where: { id } });
  await logAdminAction({
    adminId: actorId,
    action: AdminAction.USER_DELETED,
    reason,
    meta: {
      kind: "admin",
      adminTargetId: id,
      email: before.email,
      displayName: before.displayName,
      role: before.role,
    } as unknown as Prisma.InputJsonValue,
  });
}

// ── Password reset (admin-initiated) ─────────────────────────────

/**
 * Sets a new password on the target admin and returns it once so the
 * calling admin can hand it over out-of-band. We do not email the
 * plaintext password — that's an audit / phishing footgun.
 */
export async function resetAdminPassword(
  actorId: string,
  id: string,
  newPassword: string,
): Promise<void> {
  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.adminUser.update({
    where: { id },
    data: { passwordHash },
  });
  await logAdminAction({
    adminId: actorId,
    action: AdminAction.USER_PASSWORD_RESET_SENT,
    meta: {
      kind: "admin",
      adminTargetId: id,
      via: "admin-set",
    } as unknown as Prisma.InputJsonValue,
  });
}

/** Random-ish password suggestion. Base64url of 12 random bytes
 *  → 16 chars, no lookalikes. Used by the invite modal as a
 *  one-click starter password. */
export function suggestPassword(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
    .replace(/[Il01O]/g, "x");
}
