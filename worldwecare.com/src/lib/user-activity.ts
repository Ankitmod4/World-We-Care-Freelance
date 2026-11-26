/**
 * Record an entry in the user's activity feed. Every meaningful
 * account event (signup, login, password change, admin ban, …)
 * flows through here so the timeline stays complete without every
 * caller having to remember to log.
 *
 * All writes are best-effort — activity logging must never block
 * the actual operation it's tracking. We swallow errors and let the
 * caller proceed.
 */

import type { Prisma, UserActivityType } from "@prisma/client";
import { prisma } from "./db";

export async function logUserActivity(input: {
  userId: string;
  type: UserActivityType;
  message: string;
  meta?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.userActivity
    .create({
      data: {
        userId: input.userId,
        type: input.type,
        message: input.message,
        meta: input.meta ?? undefined,
      },
    })
    .catch((err) => {
      // Never let a logging failure bubble up. Log to server console
      // so we can spot systemic issues without breaking user flow.
      console.warn("[user-activity] failed:", err);
    });
}
