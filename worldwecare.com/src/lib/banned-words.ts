/**
 * Banned-word masking. Admin curates a word list; user-generated
 * text is masked with asterisks at READ time (never stored masked),
 * so editing the list updates the whole app instantly.
 *
 * The compiled regex is cached in-process with a short TTL (same
 * pattern as settings). Admin mutations clear the cache locally;
 * other instances pick up changes within the TTL.
 */

import { prisma } from "./db";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TTL_MS = 60_000;
let cache: { regex: RegExp | null; at: number } | null = null;

async function getRegex(): Promise<RegExp | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.regex;
  let regex: RegExp | null = null;
  try {
    const rows = await prisma.bannedWord.findMany({ select: { word: true } });
    const words = rows.map((r) => r.word).filter(Boolean).map(escapeRegex);
    // Word-boundary, case-insensitive. \b avoids the "Scunthorpe"
    // problem (matching inside innocent words).
    regex = words.length ? new RegExp(`\\b(?:${words.join("|")})\\b`, "gi") : null;
  } catch {
    regex = cache?.regex ?? null;
  }
  cache = { regex, at: Date.now() };
  return regex;
}

export function clearBannedWordsCache(): void {
  cache = null;
}

export type Masker = (text: string) => string;

/** Returns a fast synchronous masker for the current word list. */
export async function getMasker(): Promise<Masker> {
  const regex = await getRegex();
  if (!regex) return (t) => t;
  return (t) => (t ? t.replace(regex, (m) => "*".repeat(Math.max(1, m.length))) : t);
}

/* ── admin ops ───────────────────────────────────────────────── */

export async function listBannedWords() {
  const rows = await prisma.bannedWord.findMany({ orderBy: { word: "asc" } });
  return rows.map((r) => ({ id: r.id, word: r.word, createdAt: r.createdAt.toISOString() }));
}

/** Accepts a comma / newline separated string; returns how many new
 *  words were added (duplicates are silently ignored). */
export async function addBannedWords(input: string): Promise<number> {
  const words = [
    ...new Set(
      input
        .split(/[\n,]/)
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean)
        .filter((w) => w.length <= 60),
    ),
  ];
  let added = 0;
  for (const word of words) {
    try {
      await prisma.bannedWord.create({ data: { word } });
      added += 1;
    } catch {
      /* unique conflict — already banned */
    }
  }
  if (added) clearBannedWordsCache();
  return added;
}

export async function removeBannedWord(id: string): Promise<void> {
  await prisma.bannedWord.delete({ where: { id } });
  clearBannedWordsCache();
}
