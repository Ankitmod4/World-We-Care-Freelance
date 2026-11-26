/**
 * Record an admin action against a user (or later, another resource).
 *
 * Every admin-side mutation should call this after the DB change
 * succeeds. Best-effort — failure to log doesn't roll back the
 * actual action, but we do surface it in the console so systemic
 * problems are visible.
 *
 * Also fans out into the user's activity feed (as ADMIN_ACTION) so
 * the timeline shows the fact something happened without leaking
 * the admin identity to the user.
 */

import type { AdminAction, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { logUserActivity } from "./user-activity";

export async function logAdminAction(input: {
  adminId: string;
  action: AdminAction;
  targetUserId?: string | null;
  reason?: string | null;
  meta?: Prisma.InputJsonValue;
  /** Message written into the target user's own activity feed. Omit
   *  for actions the user shouldn't see (defensive default). */
  userFacingMessage?: string;
}): Promise<void> {
  try {
    await prisma.adminActionLog.create({
      data: {
        adminId: input.adminId,
        action: input.action,
        targetUserId: input.targetUserId ?? null,
        reason: input.reason ?? null,
        meta: input.meta ?? undefined,
      },
    });
  } catch (err) {
    console.warn("[admin-action-log] failed:", err);
  }

  if (input.targetUserId && input.userFacingMessage) {
    await logUserActivity({
      userId: input.targetUserId,
      type: "ADMIN_ACTION",
      message: input.userFacingMessage,
      // Never leak `reason` — admin notes stay admin-side.
    });
  }
}
