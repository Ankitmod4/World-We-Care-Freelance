/**
 * Finding every translatable string in the source.
 *
 * THE CATALOGUE IS DERIVED FROM `t()` CALL SITES, not from a scrape of
 * every string literal in the tree. A scrape would be faster to write
 * and wrong in both directions: it would sweep up class names, query
 * keys, URLs and date formats that no translator should ever see, and
 * it would still miss nothing, because a string only becomes
 * translatable when a component actually asks for it by key. Deriving
 * from the calls means the catalogue can never drift from the screens:
 * a string in it is on a screen, and a string on a screen is in it.
 *
 * NO TYPESCRIPT COMPILER HERE. A real parse would be more correct in
 * the abstract and would make this script depend on the project
 * building, which is precisely the condition under which you most
 * want to run it. This is a quote-aware character scanner: it knows
 * about strings, template literals, comments and regex-ish slashes
 * well enough to not read a `t(` that is inside a comment or inside
 * another string, and it refuses anything it cannot read with
 * certainty rather than guessing.
 */

/**
 * Kept in step with `errorKey` in i18n-core by importing it — a second
 * copy of a hash function is a second chance to disagree with the
 * first, and the failure would be silent: keys that never match, so
 * every refusal stays English no matter how many are translated.
 */
import { errorKey as errorKeyOf } from "./i18n-core";

export interface FoundString {
  key: string;
  english: string;
  file: string;
  line: number;
}

export interface ScanProblem {
  file: string;
  line: number;
  reason: string;
  excerpt: string;
}

export interface ScanResult {
  found: FoundString[];
  problems: ScanProblem[];
}

/** A `t(` that is a call and not part of a longer word like `format(`. */
function isCallStart(src: string, i: number): boolean {
  if (src[i] !== "t") return false;
  const before = i === 0 ? " " : src[i - 1];
  if (/[A-Za-z0-9_$.]/.test(before)) return false;
  // `function t(key: string, english: string)` — the DEFINITION of
  // t() in i18n-core, which looks exactly like a call to it and is
  // the one place in the codebase guaranteed to contain one.
  if (/\b(function|class)\s*$/.test(src.slice(Math.max(0, i - 12), i))) return false;
  let j = i + 1;
  while (j < src.length && /\s/.test(src[j])) j += 1;
  return src[j] === "(";
}

/**
 * Read one string literal starting at `i`, or null.
 *
 * A template literal with `${}` in it returns null on purpose: an
 * interpolated English sentence cannot be translated, because the
 * translator would receive a fragment. The `vars` argument of `t()`
 * exists so those become `"Posted by {name}"` instead, and this
 * refusing to read them is what makes that show up as a problem
 * rather than as a silently missing string.
 */
function readLiteral(src: string, i: number): { value: string; end: number } | null {
  const quote = src[i];
  if (quote !== '"' && quote !== "'" && quote !== "`") return null;
  let out = "";
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === "\\") {
      const n = src[j + 1];
      // \u2019 is a perfectly ordinary way to write a curly quote, and
      // a translator seeing "You haven\u2019t" instead of the
      // apostrophe would translate the escape.
      if (n === "u" && src[j + 2] === "{") {
        const close = src.indexOf("}", j + 3);
        if (close < 0) return null;
        out += String.fromCodePoint(parseInt(src.slice(j + 3, close), 16));
        j = close + 1;
        continue;
      }
      if (n === "u") {
        out += String.fromCharCode(parseInt(src.slice(j + 2, j + 6), 16));
        j += 6;
        continue;
      }
      if (n === "x") {
        out += String.fromCharCode(parseInt(src.slice(j + 2, j + 4), 16));
        j += 4;
        continue;
      }
      out +=
        n === "n" ? "\n" : n === "t" ? "\t" : n === "r" ? "\r" : n === "\n" ? "" : n;
      j += 2;
      continue;
    }
    if (quote === "`" && c === "$" && src[j + 1] === "{") return null;
    if (c === quote) return { value: out, end: j + 1 };
    if (quote !== "`" && c === "\n") return null;
    out += c;
    j += 1;
  }
  return null;
}

function lineOf(src: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (src[i] === "\n") line += 1;
  return line;
}

/**
 * Walk one file's source, collecting `t("key", "English")` calls.
 *
 * Comments and string bodies are skipped wholesale so that an example
 * of a `t()` call inside a doc comment — this file is full of them —
 * does not end up in the catalogue.
 */
export function scanSource(file: string, src: string): ScanResult {
  const found: FoundString[] = [];
  const problems: ScanProblem[] = [];

  let i = 0;
  while (i < src.length) {
    const c = src[i];

    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      // Skip the literal without interpreting what is inside it. A
      // template literal may contain `${ ... t("x","y") ... }`, so the
      // depth counter keeps us honest about where it really ends.
      const quote = c;
      i += 1;
      let depth = 0;
      while (i < src.length) {
        if (src[i] === "\\") { i += 2; continue; }
        if (quote === "`" && src[i] === "$" && src[i + 1] === "{") { depth += 1; i += 2; continue; }
        if (depth > 0 && src[i] === "}") { depth -= 1; i += 1; continue; }
        if (depth === 0 && src[i] === quote) { i += 1; break; }
        i += 1;
      }
      continue;
    }

    if (isCallStart(src, i)) {
      const at = i;
      let j = i + 1;
      while (/\s/.test(src[j])) j += 1;
      j += 1; // past "("
      while (/\s/.test(src[j])) j += 1;

      const key = readLiteral(src, j);
      if (!key) {
        /*
           `t(someVariable)` — a key the catalogue cannot know about,
           and `i18n:extract` refuses to write while one exists,
           because a string it cannot see is a string that can never
           be translated no matter how many times somebody presses
           Fill gaps.

           ONE ESCAPE HATCH, and it has to be written down. `serverText`
           computes its key from the English on purpose — that is the
           entire mechanism for refusals, and the sentences it looks up
           are collected by `scanServerMessages` instead. A line marked
           `i18n-scan: dynamic-key` says somebody decided that, rather
           than a dynamic key having crept in unnoticed.
        */
        if (allowsDynamicKey(src, at)) {
          i = at + 1;
          continue;
        }
        problems.push({
          file,
          line: lineOf(src, at),
          reason: "key is not a plain string literal",
          excerpt: src.slice(at, at + 60).split("\n")[0],
        });
        i = at + 1;
        continue;
      }
      let k = key.end;
      while (/\s/.test(src[k])) k += 1;
      if (src[k] !== ",") {
        problems.push({
          file,
          line: lineOf(src, at),
          reason: "no English given — t() needs the source text at the call site",
          excerpt: src.slice(at, at + 60).split("\n")[0],
        });
        i = at + 1;
        continue;
      }
      k += 1;
      while (/\s/.test(src[k])) k += 1;
      const english = readLiteral(src, k);
      if (!english) {
        problems.push({
          file,
          line: lineOf(src, at),
          reason: "English is interpolated — use {placeholders} and the vars argument",
          excerpt: src.slice(at, at + 80).split("\n")[0],
        });
        i = at + 1;
        continue;
      }

      found.push({
        key: key.value,
        english: english.value.trim(),
        file,
        line: lineOf(src, at),
      });
      i = english.end;
      continue;
    }

    i += 1;
  }

  return { found, problems };
}

export interface CollisionReport {
  key: string;
  variants: { english: string; file: string; line: number }[];
}

/**
 * Two screens using one key for different sentences.
 *
 * This is the failure mode that makes shared keys dangerous: the
 * catalogue holds one English per key, so the second call site's text
 * would quietly become the first one's translation. Worth stopping
 * for, not worth guessing at.
 */
export function findCollisions(found: FoundString[]): CollisionReport[] {
  const byKey = new Map<string, FoundString[]>();
  for (const f of found) {
    const list = byKey.get(f.key);
    if (list) list.push(f);
    else byKey.set(f.key, [f]);
  }
  const out: CollisionReport[] = [];
  for (const [key, list] of byKey) {
    const distinct = new Map<string, FoundString>();
    for (const f of list) if (!distinct.has(f.english)) distinct.set(f.english, f);
    if (distinct.size > 1) {
      out.push({
        key,
        variants: Array.from(distinct.values()).map((f) => ({
          english: f.english,
          file: f.file,
          line: f.line,
        })),
      });
    }
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

/** One catalogue entry per key, with the call sites folded into its context. */
export function dedupe(found: FoundString[]): {
  key: string;
  english: string;
  context: string;
}[] {
  const byKey = new Map<string, { english: string; files: Set<string> }>();
  for (const f of found) {
    const hit = byKey.get(f.key);
    if (hit) hit.files.add(f.file);
    else byKey.set(f.key, { english: f.english, files: new Set([f.file]) });
  }
  return Array.from(byKey.entries())
    .map(([key, v]) => ({
      key,
      english: v.english,
      // The translator's only clue about where a string appears, so it
      // is a file list and not a count.
      context: Array.from(v.files).sort().join(", ").slice(0, 300),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/* ── messages the server throws ──────────────────────────────── */

/**
 * Refusals, so they can be translated too.
 *
 * ── WHY THIS IS A SEPARATE SCANNER ──
 *
 * `scanSource` looks for `t(key, english)` — a call the author wrote
 * on purpose, with a key they chose. There is no such call at a throw
 * site: `throw new StreakRefused("Pick a date.")` is a sentence with
 * no key anywhere near it, and by the time a reader sees it the
 * sentence has passed through a route handler and a toast that both
 * treat it as opaque text. `errorKey()` derives the key from the
 * English so those three layers never have to agree on anything.
 *
 * ── WHAT COUNTS AS A REFUSAL ──
 *
 * Only sentences a member could be shown. `"userId required"` and
 * `"Unauthorized"` are protocol, not prose: nobody reading Russian is
 * helped by a translated `"Invalid reason"` that only ever appears
 * when a request was malformed. So the filter is deliberately picky —
 * a capital letter, at least two words, and no identifier-shaped
 * runs. A borderline string left out costs nothing; a technical one
 * let in costs a translation and a line of noise in the admin list.
 *
 * ── AND WHY INTERPOLATION IS SKIPPED ──
 *
 * A template literal has no fixed English to file under, so
 * `` `${name} is taken` `` is not collected and stays English. Those
 * are the ones worth rewriting by hand; this is for the fixed
 * sentences, which is nearly all of them.
 */

/** Constructors whose first argument is shown to a member. */
const REFUSAL_CALL =
  /\bnew\s+[A-Z][A-Za-z]*(?:Refused|Error)\s*\(\s*"((?:[^"\\]|\\.)*)"/g;
/** `{ error: "…" }` written inline in a route. */
const ERROR_FIELD = /\berror:\s*"((?:[^"\\]|\\.)*)"/g;

export function looksLikeProse(text: string): boolean {
  const s = text.trim();
  if (s.length < 8 || s.length > 300) return false;
  if (!/^[A-Z]/.test(s)) return false;
  // Two words at least, so "Unauthorized" and "Forbidden" stay out.
  if (!/\s/.test(s)) return false;
  // Identifier-shaped runs: camelCase, snake_case, dotted paths, a
  // stray `${`. All of these mean the string is for a log, not a
  // person.
  if (/[a-z][A-Z]|_|\$\{|\bhttps?:\/\//.test(s)) return false;
  // A sentence, a question, or something with real punctuation in it.
  return /[.!?—’']/.test(s) || s.split(/\s+/).length >= 3;
}

/**
 * True when the pragma appears in the few lines just above the call.
 *
 * THREE LINES, not one. The pragma is a decision that wants
 * explaining, and an explanation runs to a sentence or two — a
 * one-line window would mean the marker had to sit immediately above
 * the call with its reasoning pushed somewhere else, which is exactly
 * how a pragma ends up with no reason attached to it.
 */
function allowsDynamicKey(src: string, at: number): boolean {
  let start = at;
  for (let n = 0; n < 4 && start > 0; n += 1) {
    const prev = src.lastIndexOf("\n", start - 1);
    if (prev < 0) {
      start = 0;
      break;
    }
    start = prev;
  }
  return src.slice(start, at).includes("i18n-scan: dynamic-key");
}

export function scanServerMessages(file: string, src: string): FoundString[] {
  const out: FoundString[] = [];
  const seen = new Set<string>();
  const lineOf = (index: number) => src.slice(0, index).split("\n").length;

  for (const re of [REFUSAL_CALL, ERROR_FIELD]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const raw = m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
      if (!looksLikeProse(raw)) continue;
      if (seen.has(raw)) continue;
      seen.add(raw);
      out.push({ key: errorKeyOf(raw), english: raw, file, line: lineOf(m.index) });
    }
  }
  return out;
}
