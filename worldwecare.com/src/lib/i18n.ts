/**
 * Reading translations, and choosing which language to read.
 *
 * TRANSLATIONS LIVE IN THE DATABASE so the admin page can change one
 * without a deploy — which is the entire point of having an admin
 * page. The cost of that is a query per render, and the answer to
 * that is this module's cache: one locale's whole message set is a
 * few hundred short strings, so it is held in memory and dropped when
 * an admin saves.
 *
 * THE CACHE IS PER-PROCESS AND DELIBERATELY DUMB. Behind more than
 * one server process each holds its own copy, so a save takes effect
 * on the others within `TTL` rather than instantly. That is the right
 * trade for text: a button reading the old wording for a minute is
 * not worth a Redis dependency. If this ever becomes a real problem
 * the fix is a shared cache, not a shorter TTL.
 *
 * ENGLISH IS NOT IN THE DATABASE AS A TRANSLATION. It is the source,
 * held on the string itself, so there is exactly one English and no
 * way for a `Translation` row in "en" to disagree with it.
 */

import { prisma } from "./db";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  makeT,
  type LocaleView,
  type Messages,
  type TFunction,
} from "./i18n-core";

import { hashSource } from "./i18n-core";
import { getSetting } from "./settings";

export { DEFAULT_LOCALE, LOCALE_COOKIE, makeT, hashSource };
export type { LocaleView, Messages, TFunction };

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; messages: Messages }>();
let localesCache: { at: number; rows: LocaleView[] } | null = null;

/** Called by every admin write. Cheap, and the alternative is stale text. */
export function clearI18nCache(): void {
  cache.clear();
  localesCache = null;
}

/** Where the admin's "show the language picker" switch lives. */
export const PICKER_SETTING = "translation.showPicker";

/**
 * Is the member-facing language control switched on?
 *
 * Defaults to ON, so an install that has never touched the setting
 * behaves exactly as it did before the switch existed.
 */
export async function pickerEnabled(): Promise<boolean> {
  return (await getSetting<boolean>(PICKER_SETTING, true)) !== false;
}

/**
 * The languages a member may actually choose.
 *
 * English is prepended rather than stored: it is the source language,
 * it can never be disabled, and a row for it would be a row somebody
 * could switch off.
 *
 * ── THE ADMIN'S SWITCH IS ENFORCED HERE, NOT IN THE HEADER ──
 *
 * Hiding the icon and leaving everything else alone would be a trap:
 * somebody who had already chosen Russian would carry on reading a
 * Russian site with no way back to English, and the admin who turned
 * the switch off would have no idea. So "off" means this function
 * returns English alone — which hides the picker (it already hides
 * itself below two options), sends `resolveLocale` to English for
 * everybody, and stops the content translator being asked for
 * anything.
 *
 * NOBODY'S CHOICE IS DESTROYED. The cookie is left exactly where it
 * is, so turning the switch back on restores every member to the
 * language they picked rather than to English.
 */
export async function listEnabledLocales(): Promise<LocaleView[]> {
  if (localesCache && Date.now() - localesCache.at < TTL_MS) return localesCache.rows;
  const ENGLISH: LocaleView = {
    code: DEFAULT_LOCALE,
    name: "English",
    nativeName: "English",
    direction: "LTR",
  };
  if (!(await pickerEnabled())) {
    localesCache = { at: Date.now(), rows: [ENGLISH] };
    return localesCache.rows;
  }
  const rows = await prisma.locale.findMany({
    where: { isEnabled: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { code: true, name: true, nativeName: true, direction: true },
  });
  const out: LocaleView[] = [
    ENGLISH,
    ...rows
      .filter((r) => r.code !== DEFAULT_LOCALE)
      .map((r) => ({ ...r, direction: r.direction as "LTR" | "RTL" })),
  ];
  localesCache = { at: Date.now(), rows: out };
  return out;
}

/** Null for anything not currently enabled, so a stale cookie falls back. */
export async function resolveLocale(code: string | null | undefined): Promise<LocaleView> {
  const all = await listEnabledLocales();
  return all.find((l) => l.code === code) ?? all[0];
}

/**
 * Every string for one locale, keyed.
 *
 * A MISSING TRANSLATION IS ABSENT, not empty: `t()` falls back to the
 * English, so a half-translated language reads as mostly-its-language
 * rather than as a page of blanks. That is the behaviour that lets a
 * language be switched on before it is finished.
 */
export async function getMessages(locale: string): Promise<Messages> {
  if (locale === DEFAULT_LOCALE) return {};
  const hit = cache.get(locale);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.messages;

  const rows = await prisma.translation.findMany({
    where: { localeCode: locale, value: { not: "" } },
    select: { value: true, string: { select: { key: true } } },
  });
  const messages: Messages = {};
  for (const r of rows) messages[r.string.key] = r.value;
  cache.set(locale, { at: Date.now(), messages });
  return messages;
}

/**
 * `t()` for server components, read straight from the request.
 *
 * A page does not have to be handed the locale to translate: it reads
 * the same cookie the layout read, and Next dedupes the cookie access
 * within a render. The alternative — threading a `t` prop down from
 * the layout — would mean editing every page's signature to deliver
 * something that is the same for the whole request.
 */
export async function getT(): Promise<TFunction> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const locale = await resolveLocale(jar.get(LOCALE_COOKIE)?.value);
  const messages = await getMessages(locale.code);
  return makeT(messages);
}
