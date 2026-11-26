/**
 * Google Cloud Translation, behind one function.
 *
 * ONE FILE, so the vendor is a detail. Everything else in the codebase
 * calls `translateBatch` and `listSupportedLanguages`; swapping to
 * Azure or DeepL later is this file and nothing else. That matters
 * more than usual here because the free tiers move around and the
 * decision to use Google was made on price, not on capability.
 *
 * THE KEY LIVES IN `platform_settings`, so an admin can paste it in
 * without shell access or a redeploy — which is the whole reason the
 * admin page exists. The environment is still read as a FALLBACK, so
 * an existing deployment that set GOOGLE_TRANSLATE_API_KEY keeps
 * working and anyone who would rather keep credentials out of the
 * database still can.
 *
 * BECAUSE IT IS IN THE DATABASE, IT IS NEVER SENT BACK OUT. The admin
 * API returns whether a key is set, where it came from, and its last
 * four characters — enough to tell one key from another, not enough
 * to use. A settings page that renders the credential into the HTML
 * is a credential in every screenshot and every browser cache.
 *
 * If no key is set the admin page says so plainly and the buttons
 * refuse, rather than failing per-request.
 *
 * v2 rather than v3: v2 takes an API key, v3 wants a service account
 * and a GCP project id. For translating interface strings the models
 * are the same and v2 is the one somebody can set up in five minutes.
 */

import { getSetting } from "./settings";

const ENDPOINT = "https://translation.googleapis.com/language/translate/v2";

/** Where the admin page stores it. */
export const KEY_SETTING = "translation.googleApiKey";

export class TranslateError extends Error {}

export type KeySource = "database" | "environment" | "none";

/**
 * The key, and where it came from.
 *
 * DATABASE FIRST. The admin page is the thing people will actually
 * use, so a key pasted there has to beat a stale one left in the
 * environment — otherwise saving a new key appears to do nothing,
 * which is the worst possible failure for a credential field.
 */
export async function translationKey(): Promise<{ key: string | null; source: KeySource }> {
  const stored = (await getSetting<string>(KEY_SETTING, "")).trim();
  if (stored) return { key: stored, source: "database" };
  const env = (process.env.GOOGLE_TRANSLATE_API_KEY ?? "").trim();
  if (env) return { key: env, source: "environment" };
  return { key: null, source: "none" };
}

export async function translationConfigured(): Promise<boolean> {
  return (await translationKey()).key !== null;
}

/**
 * The last four characters, for telling one key from another.
 *
 * Never the key itself: this value reaches the browser, and a
 * credential that reaches the browser is in the page source, the
 * back/forward cache and any screenshot of the settings page.
 */
export function keyHint(k: string): string {
  return k.length <= 4 ? "\u2022\u2022\u2022\u2022" : "\u2022\u2022\u2022\u2022" + k.slice(-4);
}

async function key(): Promise<string> {
  const { key: k } = await translationKey();
  if (!k) {
    throw new TranslateError(
      "No Google Translate key. Add one on the Translations page, or set " +
        "GOOGLE_TRANSLATE_API_KEY in the server environment.",
    );
  }
  return k;
}

/**
 * The languages Google can translate into, named in English and in
 * themselves.
 *
 * Asked of Google rather than hardcoded: the list grows, and a
 * hardcoded copy is a list that is wrong the first time it changes.
 * `target=en` makes Google return the English names alongside the
 * codes; the native names come from the browser's own Intl data,
 * which knows them without a second request.
 */
export async function listSupportedLanguages(): Promise<
  Array<{ code: string; name: string; nativeName: string }>
> {
  const res = await fetch(`${ENDPOINT}/languages?key=${await key()}&target=en`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new TranslateError(await readError(res));
  }
  const d = (await res.json()) as {
    data?: { languages?: Array<{ language: string; name: string }> };
  };
  const rows = d.data?.languages ?? [];
  return rows.map((l) => ({
    code: l.language,
    name: l.name,
    nativeName: nativeNameOf(l.language, l.name),
  }));
}

/**
 * The language's name in itself.
 *
 * `Intl.DisplayNames` in the language's own locale is exactly this,
 * and it ships with Node. It throws on a code it does not recognise,
 * which is why the English name is the fallback rather than a crash:
 * a picker showing "Hmong" instead of the Hmong word for Hmong is a
 * small loss, and an admin page that 500s because of one obscure code
 * is not.
 */
function nativeNameOf(code: string, fallback: string): string {
  try {
    const dn = new Intl.DisplayNames([code], { type: "language" });
    const n = dn.of(code);
    if (!n || n.toLowerCase() === code.toLowerCase()) return fallback;
    // Most languages capitalise their own name in a list even where
    // they would not mid-sentence.
    return n.charAt(0).toUpperCase() + n.slice(1);
  } catch {
    return fallback;
  }
}

/**
 * Which way a language runs.
 *
 * A short list, because it IS a short list — these are the living
 * RTL scripts, and the set does not change the way the language list
 * does. Matched on the base subtag so "ar-EG" and "ar" agree.
 */
const RTL = new Set([
  "ar", "arc", "az", "ckb", "dv", "fa", "he", "iw", "ku", "ps",
  "sd", "syr", "ug", "ur", "yi",
]);

export function directionOf(code: string): "LTR" | "RTL" {
  return RTL.has(code.split("-")[0].toLowerCase()) ? "RTL" : "LTR";
}

/**
 * Translate a batch of strings into one language.
 *
 * BATCHED, because Google takes up to 128 `q` parameters per request
 * and a string-at-a-time loop over 623 of them is 623 round trips.
 * The order comes back the way it went in, which is the contract the
 * caller relies on to match results to keys.
 *
 * `format: "text"` matters: the default is HTML, which escapes
 * apostrophes into &#39; and hands you entities to clean up in every
 * translation of every contraction.
 */
/** `{name}` — the placeholders `makeT` substitutes at render time. */
const PLACEHOLDER = /\{(\w+)\}/g;

export function placeholdersIn(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[1]).sort();
}

/**
 * Hide the placeholders from the translator.
 *
 * THIS IS NOT OPTIONAL, and the crisis card is why. "Call or text
 * {number}" went to Google as plain text, came back as "Позвоните ...
 * на номер {номер}" — Google translated the TOKEN, so nothing matched
 * `{number}` at render time and a member in crisis was shown the
 * literal string "{номер}" where the phone number should have been.
 *
 * `<span class="notranslate">` is the documented way to tell Google to
 * leave a run alone, and it only works in HTML mode — which is why
 * this sends HTML and unescapes the entities on the way back rather
 * than using the simpler text mode.
 */
function protect(text: string): string {
  return escapeHtml(text).replace(PLACEHOLDER, (m) => `<span class="notranslate">${m}</span>`);
}

function unprotect(html: string): string {
  return unescapeHtml(html.replace(/<span class="notranslate">\s*(\{\w+\})\s*<\/span>/g, "$1"));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function unescapeHtml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&(?:#x27|apos|rsquo);/g, "\u2019")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/**
 * `source` may be `null` for "work it out".
 *
 * Interface strings are always English so they pass "en", which is
 * both cheaper and more accurate. Member-written content has no
 * declared language — passing "en" for a post somebody wrote in
 * Polish asks Google to translate Polish as though it were English,
 * and it will produce something. So content translation passes null
 * and lets detection do its job.
 */
export async function translateBatch(
  texts: string[],
  target: string,
  source: string | null = "en",
): Promise<string[]> {
  if (texts.length === 0) return [];

  const out: string[] = [];
  const CHUNK = 100;
  for (let i = 0; i < texts.length; i += CHUNK) {
    const slice = texts.slice(i, i + CHUNK);
    const body = new URLSearchParams();
    body.set("key", await key());
    body.set("target", target);
    if (source) body.set("source", source);
    // HTML, not text: that is the only mode in which `notranslate`
    // means anything to Google.
    body.set("format", "html");
    for (const t of slice) body.append("q", protect(t));

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    if (!res.ok) throw new TranslateError(await readError(res));

    const d = (await res.json()) as {
      data?: { translations?: Array<{ translatedText: string }> };
    };
    const got = d.data?.translations ?? [];
    if (got.length !== slice.length) {
      // Never pad or guess: a short response silently mis-aligns every
      // key after the gap, which would file translations under the
      // wrong strings and be very hard to see.
      throw new TranslateError(
        `Google returned ${got.length} translations for ${slice.length} strings.`,
      );
    }
    for (let j = 0; j < got.length; j += 1) {
      const cleaned = unprotect(got[j].translatedText);
      // THE LAST LINE OF DEFENCE. Even with `notranslate`, a
      // translation that came back missing a placeholder cannot be
      // rendered — `makeT` would leave a hole where a number, a name
      // or an amount belongs. Hand back the ENGLISH for that one
      // rather than a broken translation; the caller counts it and
      // the admin sees it as still-missing, which is true.
      const before = placeholdersIn(slice[j]).join(",");
      const after = placeholdersIn(cleaned).join(",");
      out.push(before === after ? cleaned : slice[j]);
    }
  }
  return out;
}

/** Google's errors say something useful; a status code does not. */
async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const d = JSON.parse(text) as { error?: { message?: string } };
    if (d.error?.message) return `Google Translate: ${d.error.message}`;
  } catch {
    /* not JSON */
  }
  return `Google Translate failed (${res.status}).`;
}
