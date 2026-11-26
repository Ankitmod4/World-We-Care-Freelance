/**
 * Password hashing wrappers.
 *
 * bcrypt cost 10 for now — bump to 12 before production. Kept in one
 * file so tuning the cost is a one-line change across every place
 * that stores or verifies a password.
 */

import bcrypt from "bcryptjs";

const COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
