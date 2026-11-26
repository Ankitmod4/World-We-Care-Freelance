/**
 * Singleton Prisma client. Next.js hot-reloads modules on every save
 * in dev, which would otherwise spawn a new PrismaClient per HMR
 * cycle and exhaust the MySQL connection pool within minutes. The
 * global cache keeps a single instance across reloads.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
