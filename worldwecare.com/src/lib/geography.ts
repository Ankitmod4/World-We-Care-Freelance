/**
 * The public country list.
 *
 * One definition, used by both the API route and the signup page, so
 * the two cannot drift into disagreeing about which countries exist.
 */

import { prisma } from "./db";

export interface CountryOption {
  id: string;
  name: string;
  code: string;
  slug: string;
  emojiFlag: string | null;
}

export async function listActiveCountries(): Promise<CountryOption[]> {
  return prisma.country.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, slug: true, emojiFlag: true },
  });
}
