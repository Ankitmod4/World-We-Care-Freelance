/**
 * The translation admin's operations.
 *
 * WHAT THE ADMIN PAGE IS FOR, in one line: Google fills the blanks and
 * a person fixes what it got wrong. Everything here serves that —
 * enabling a language, machine-filling it, editing one string, and
 * saying which of those two a given line came from.
 *
 * MACHINE OUTPUT IS SHOWN TO MEMBERS UNREVIEWED, and that is a choice
 * rather than an oversight: a rough Spanish sentence beats an English
 * one somebody cannot read at all. What the page owes in exchange is
 * honesty about which is which, which is why `source` is on every row
 * and visible in the list.
 */

import { prisma } from "./db";
import { setSettings, purgeSettingsCache } from "./settings";
import { PICKER_SETTING, clearI18nCache, hashSource, pickerEnabled } from "./i18n";
import {
  directionOf,
  listSupportedLanguages,
  translateBatch,
  placeholdersIn,
  translationConfigured,
  translationKey,
  keyHint,
  KEY_SETTING,
  type KeySource,
} from "./google-translate";

export { translationConfigured, translationKey, keyHint, KEY_SETTING };
export type { KeySource };

/**
 * What the admin page is allowed to know about the key.
 *
 * Deliberately not the key. "Set, from the database, ending 7f2a" is
 * everything somebody needs to answer "is the right key in there?"
 * without the page ever holding the credential.
 */
export async function translationKeyStatus(): Promise<{
  configured: boolean;
  source: KeySource;
  hint: string | null;
  showPicker: boolean;
}> {
  const { key, source } = await translationKey();
  return {
    configured: !!key,
    source,
    hint: key ? keyHint(key) : null,
    showPicker: await pickerEnabled(),
  };
}

/**
 * Show or hide the member-facing language control.
 *
 * OFF MEANS THE SITE IS ENGLISH, not "the icon is hidden" — see the
 * long note on `listEnabledLocales`. Hiding only the control would
 * strand every member who had already picked a language with no way
 * back, which is the sort of thing an admin discovers from a support
 * message six weeks later.
 *
 * Both caches are cleared: the setting lives in the settings cache and
 * the locale list in i18n's own, and leaving either would mean the
 * switch appeared to do nothing for a minute.
 */
export async function setPickerEnabled(on: boolean): Promise<void> {
  await setSettings([{ key: PICKER_SETTING, value: on }]);
  purgeSettingsCache();
  clearI18nCache();
}

/**
 * Store the key, or clear it.
 *
 * An empty string CLEARS the row rather than storing "", so that
 * clearing it in the admin falls back to the environment instead of
 * shadowing it with a blank that beats everything.
 */
export async function setTranslationKey(raw: string): Promise<void> {
  const value = raw.trim();
  await setSettings([{ key: KEY_SETTING, value }]);
  // The settings cache is per-process and the adapter reads through
  // it, so without this the next call still uses the old key.
  purgeSettingsCache();
}

export interface LocaleRow {
  code: string;
  name: string;
  nativeName: string;
  direction: "LTR" | "RTL";
  isEnabled: boolean;
  sortOrder: number;
  /** How much of the catalogue this language has. */
  translated: number;
  reviewed: number;
  stale: number;
}

/**
 * Pull Google's language list into the database.
 *
 * UPSERTED, and an existing row's `isEnabled`, `sortOrder` and
 * `nativeName` are left alone: the team may have switched a language
 * on, moved it up the picker, or corrected a native name Google's
 * Intl data got wrong, and a refresh must not undo any of that.
 */
export async function syncSupportedLanguages(): Promise<{ added: number; total: number }> {
  const langs = await listSupportedLanguages();
  let added = 0;
  for (const l of langs) {
    if (l.code === "en") continue; // the source language is not a translation
    const existing = await prisma.locale.findUnique({
      where: { code: l.code },
      select: { code: true },
    });
    if (existing) {
      // Only the English name, which is Google's to own.
      await prisma.locale.update({ where: { code: l.code }, data: { name: l.name } });
      continue;
    }
    await prisma.locale.create({
      data: {
        code: l.code,
        name: l.name,
        nativeName: l.nativeName,
        direction: directionOf(l.code),
      },
    });
    added += 1;
  }
  clearI18nCache();
  return { added, total: langs.length };
}

/** Every language, with how far along it is. For the admin list. */
export async function listLocalesWithProgress(): Promise<{
  locales: LocaleRow[];
  totalStrings: number;
}> {
  const [locales, totalStrings, counts, reviewed, strings] = await Promise.all([
    prisma.locale.findMany({ orderBy: [{ isEnabled: "desc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    prisma.translationString.count(),
    prisma.translation.groupBy({
      by: ["localeCode"],
      where: { value: { not: "" } },
      _count: { _all: true },
    }),
    prisma.translation.groupBy({
      by: ["localeCode"],
      where: { reviewedAt: { not: null } },
      _count: { _all: true },
    }),
    prisma.translationString.findMany({ select: { id: true, sourceHash: true } }),
  ]);

  // "Stale" is a translation whose English has been edited since.
  // Counted here rather than in SQL because it is a comparison between
  // two columns on different tables, which Prisma cannot express.
  const currentHash = new Map(strings.map((s) => [s.id, s.sourceHash]));
  const staleRows = await prisma.translation.findMany({
    select: { localeCode: true, stringId: true, sourceHash: true },
  });
  const stale = new Map<string, number>();
  for (const r of staleRows) {
    if (currentHash.get(r.stringId) !== r.sourceHash) {
      stale.set(r.localeCode, (stale.get(r.localeCode) ?? 0) + 1);
    }
  }

  const byCode = new Map(counts.map((c) => [c.localeCode, c._count._all]));
  const revByCode = new Map(reviewed.map((c) => [c.localeCode, c._count._all]));

  return {
    totalStrings,
    locales: locales.map((l) => ({
      code: l.code,
      name: l.name,
      nativeName: l.nativeName,
      direction: l.direction as "LTR" | "RTL",
      isEnabled: l.isEnabled,
      sortOrder: l.sortOrder,
      translated: byCode.get(l.code) ?? 0,
      reviewed: revByCode.get(l.code) ?? 0,
      stale: stale.get(l.code) ?? 0,
    })),
  };
}

export async function setLocaleEnabled(code: string, isEnabled: boolean) {
  const row = await prisma.locale.update({ where: { code }, data: { isEnabled } });
  clearI18nCache();
  return row;
}

export async function setLocaleOrder(code: string, sortOrder: number) {
  const row = await prisma.locale.update({ where: { code }, data: { sortOrder } });
  clearI18nCache();
  return row;
}

export interface StringRow {
  id: string;
  key: string;
  english: string;
  context: string | null;
  value: string | null;
  source: "GOOGLE" | "HUMAN" | null;
  reviewed: boolean;
  stale: boolean;
}

/**
 * The catalogue for one language.
 *
 * `filter` is what makes this usable at 600+ rows: the job is almost
 * always "show me what is missing" or "show me what Google did that
 * nobody has checked", not "show me everything".
 */
export async function listStrings(opts: {
  locale: string;
  filter?: "all" | "missing" | "machine" | "reviewed" | "stale";
  q?: string;
  take?: number;
  skip?: number;
}): Promise<{ rows: StringRow[]; total: number }> {
  const take = Math.min(200, Math.max(1, opts.take ?? 50));
  const skip = Math.max(0, opts.skip ?? 0);
  const q = opts.q?.trim();

  const where = q
    ? { OR: [{ key: { contains: q } }, { english: { contains: q } }] }
    : {};

  const strings = await prisma.translationString.findMany({
    where,
    orderBy: { key: "asc" },
    select: {
      id: true, key: true, english: true, context: true, sourceHash: true,
      translations: {
        where: { localeCode: opts.locale },
        select: { value: true, source: true, reviewedAt: true, sourceHash: true },
      },
    },
  });

  const rows: StringRow[] = strings.map((s) => {
    const t = s.translations[0];
    return {
      id: s.id,
      key: s.key,
      english: s.english,
      context: s.context,
      value: t?.value ?? null,
      source: (t?.source as "GOOGLE" | "HUMAN") ?? null,
      reviewed: !!t?.reviewedAt,
      stale: !!t && t.sourceHash !== s.sourceHash,
    };
  });

  const f = opts.filter ?? "all";
  const filtered = rows.filter((r) => {
    if (f === "missing") return !r.value;
    if (f === "machine") return r.source === "GOOGLE" && !r.reviewed;
    if (f === "reviewed") return r.reviewed;
    if (f === "stale") return r.stale;
    return true;
  });

  return { rows: filtered.slice(skip, skip + take), total: filtered.length };
}

/**
 * Fill in what Google can, for one language.
 *
 * ONLY WHAT IS MISSING OR STALE. A human correction is never
 * overwritten by a machine — that is the one rule this button has to
 * keep, because losing an afternoon of somebody's careful Spanish to
 * a mis-click is not recoverable.
 */
export async function machineTranslateMissing(
  locale: string,
  opts: { includeStale?: boolean; limit?: number } = {},
): Promise<{ translated: number; skipped: number }> {
  const strings = await prisma.translationString.findMany({
    select: {
      id: true, english: true, sourceHash: true,
      translations: {
        where: { localeCode: locale },
        select: { id: true, source: true, sourceHash: true, reviewedAt: true, value: true },
      },
    },
  });

  const todo = strings.filter((s) => {
    const t = s.translations[0];
    if (!t) return true;                                   // nothing yet
    if (t.reviewedAt) return false;                        // a person signed this off
    if (t.source === "HUMAN") return false;                // a person wrote it
    // A MACHINE TRANSLATION THAT LOST A PLACEHOLDER IS NOT A
    // TRANSLATION. Earlier batches went out as plain text, so Google
    // translated the tokens themselves — "{number}" came back as
    // "{номер}" and the crisis card rendered the literal braces where
    // a phone number belonged. Those rows are already stored, so
    // "nothing is missing" would leave them there forever: treat a
    // broken one as work to do, and the next Fill gaps repairs it.
    if (placeholdersIn(s.english).join(",") !== placeholdersIn(t.value).join(",")) return true;
    if (opts.includeStale && t.sourceHash !== s.sourceHash) return true;
    return false;
  });

  const limited = opts.limit ? todo.slice(0, opts.limit) : todo;
  if (limited.length === 0) {
    return { translated: 0, skipped: strings.length };
  }

  const raw = await translateBatch(limited.map((s) => s.english), locale);

  /*
   * CHECKED HERE, NOT ONLY IN THE ADAPTER.
   *
   * The Google adapter also refuses a translation that lost a
   * placeholder, and that is worth having — but it is the wrong and
   * only place for it. This function is what WRITES to the database,
   * so this is the last point at which a broken string can be stopped,
   * and it holds however the text was produced: Google today, DeepL or
   * a bulk import tomorrow.
   *
   * "Broken" means the set of {placeholders} changed. Rendering one of
   * those puts a literal "{номер}" on screen where a phone number
   * belongs — which is exactly what happened on the crisis card.
   */
  const out: string[] = [];
  let dropped = 0;
  for (let i = 0; i < limited.length; i += 1) {
    const english = limited[i].english;
    if (placeholdersIn(raw[i]).join(",") === placeholdersIn(english).join(",")) {
      out.push(raw[i]);
    } else {
      // English, so the reader sees a whole sentence with the real
      // value in it rather than a translated one with a hole.
      out.push(english);
      dropped += 1;
    }
  }

  for (const [i, s] of limited.entries()) {
    await prisma.translation.upsert({
      where: { stringId_localeCode: { stringId: s.id, localeCode: locale } },
      create: {
        stringId: s.id,
        localeCode: locale,
        value: out[i],
        source: "GOOGLE",
        sourceHash: s.sourceHash,
      },
      update: {
        value: out[i],
        source: "GOOGLE",
        sourceHash: s.sourceHash,
        // A re-machine-translation is not reviewed, whatever it was.
        reviewedAt: null,
        reviewedByAdminId: null,
      },
    });
  }

  clearI18nCache();
  return {
    translated: limited.length - dropped,
    skipped: strings.length - limited.length + dropped,
  };
}

/** One string, typed by a person. Always HUMAN, always reviewed. */
export async function saveTranslation(
  stringId: string,
  locale: string,
  value: string,
  adminId: string,
) {
  const s = await prisma.translationString.findUnique({
    where: { id: stringId },
    select: { sourceHash: true },
  });
  if (!s) throw new Error("String not found");

  const clean = value.trim();
  const row = await prisma.translation.upsert({
    where: { stringId_localeCode: { stringId, localeCode: locale } },
    create: {
      stringId, localeCode: locale, value: clean,
      source: "HUMAN", sourceHash: s.sourceHash,
      reviewedAt: new Date(), reviewedByAdminId: adminId,
    },
    update: {
      value: clean, source: "HUMAN", sourceHash: s.sourceHash,
      reviewedAt: new Date(), reviewedByAdminId: adminId,
    },
  });
  clearI18nCache();
  return row;
}

/** "Google got this one right" — keeps the text, records the sign-off. */
export async function markReviewed(stringId: string, locale: string, adminId: string) {
  const s = await prisma.translationString.findUnique({
    where: { id: stringId },
    select: { sourceHash: true },
  });
  if (!s) throw new Error("String not found");
  const row = await prisma.translation.update({
    where: { stringId_localeCode: { stringId, localeCode: locale } },
    data: { reviewedAt: new Date(), reviewedByAdminId: adminId, sourceHash: s.sourceHash },
  });
  clearI18nCache();
  return row;
}

/**
 * Put a string into the catalogue.
 *
 * Used by `scripts/extract-strings.ts`. Editing the English changes
 * `sourceHash`, which is what makes every existing translation of it
 * show as stale rather than quietly standing in for a sentence that
 * has changed underneath it.
 */
export async function upsertString(input: {
  key: string;
  english: string;
  context?: string | null;
}) {
  const sourceHash = await hashSource(input.english);
  return prisma.translationString.upsert({
    where: { key: input.key },
    create: {
      key: input.key,
      english: input.english,
      context: input.context ?? null,
      sourceHash,
    },
    update: {
      english: input.english,
      context: input.context ?? null,
      sourceHash,
    },
  });
}
