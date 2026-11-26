/**
 * The parts of i18n that do not touch the database.
 *
 * SPLIT OUT SO CLIENT COMPONENTS CAN IMPORT THEM. `i18n.ts` imports
 * the Prisma client; anything a `"use client"` file imports is pulled
 * into the browser bundle, so importing `makeT` from there would drag
 * the database layer across the boundary — at best a much larger
 * bundle, at worst a build error. This module has no imports at all,
 * which is what makes it safe on both sides.
 */

export const DEFAULT_LOCALE = "en";

/** Where the member's choice lives. Read on the server, written on the client. */
export const LOCALE_COOKIE = "wwc-locale";

export type Messages = Record<string, string>;

export interface LocaleView {
  code: string;
  name: string;
  nativeName: string;
  direction: "LTR" | "RTL";
}

/**
 * The lookup the components use.
 *
 * `english` is passed at the CALL SITE rather than fetched, which is
 * what keeps this readable in a component:
 *
 *     t("campaigns.startOne", "Start a campaign")
 *
 * The English is right there next to the key, so nobody has to open
 * another file to know what a screen says, and a missing translation
 * degrades to the exact text that was there before any of this
 * existed.
 */
export function makeT(messages: Messages) {
  return function t(key: string, english: string, vars?: Record<string, string | number>) {
    const raw = messages[key] ?? english;
    if (!vars) return raw;
    // {count} rather than positional %s: a translator reordering a
    // sentence has to be able to move the placeholder with it.
    return raw.replace(/\{(\w+)\}/g, (m, name: string) =>
      name in vars ? String(vars[name]) : m,
    );
  };
}

export type TFunction = ReturnType<typeof makeT>;

/** SHA-256 of the source text, so an edited English un-reviews its translations. */
export async function hashSource(text: string): Promise<string> {
  const data = new TextEncoder().encode(text.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ── server-thrown messages ──────────────────────────────────── */

/**
 * The catalogue key for a message the SERVER wrote.
 *
 * ── WHY THESE CANNOT USE A HAND-WRITTEN KEY ──
 *
 * Everything else on the site says `t("streak.pickDate", "Pick a
 * date.")` at the point it is rendered. Refusals cannot: they are
 * thrown deep in `lib/`, where there is no reader and no `t`, travel
 * through sixty API routes as `{ error: err.message }`, and are shown
 * by a toast that knows nothing about where the sentence came from.
 * Rewriting all three layers to carry a key would be a very large
 * change to error handling — the part of the code least worth
 * destabilising — for one string each.
 *
 * So the ENGLISH ITSELF is the key. `errorKey("Pick a date.")` is the
 * same value wherever it is computed: the extractor derives it from
 * the source literal and files the translation under it; the toast
 * derives it from the sentence that came back over the wire and finds
 * it. Nothing in between has to change or even know.
 *
 * ── WHAT THIS COSTS ──
 *
 * Two refusals that happen to word themselves identically share one
 * translation. That is correct, not a collision: they say the same
 * thing. And a message built by interpolation — `${name} not found` —
 * has no literal to extract, so it stays English. Those are the ones
 * worth rewriting as proper `t()` calls over time; this handles the
 * fixed sentences, which are the overwhelming majority.
 *
 * FNV-1a, not SHA-256: it has to run synchronously inside a render,
 * and `crypto.subtle` is a promise. The risk a hash collision carries
 * here is that one refusal shows another refusal's wording — over a
 * few hundred short strings, at 32 bits, that is not a risk worth
 * paying a promise for.
 */
export function errorKey(english: string): string {
  const s = english.trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return "error." + h.toString(16).padStart(8, "0");
}

/**
 * A message from the server, in the reader's language.
 *
 * Falls through to the English, which is always a whole sentence
 * somebody wrote — never a key, never a blank toast.
 */
export function serverText(t: TFunction, english: string | null | undefined): string {
  const s = (english ?? "").trim();
  if (!s) return "";
  // i18n-scan: dynamic-key — see errorKey above. These sentences are
  // collected by scanServerMessages, not from this call.
  return t(errorKey(s), s);
}
