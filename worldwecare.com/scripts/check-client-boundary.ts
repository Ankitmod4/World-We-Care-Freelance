/**
 * Does a server file import a plain VALUE out of a "use client" file?
 *
 *   npm run check:boundary
 *
 * WHY THIS EXISTS. It is not a style rule. When a Server Component
 * imports from a client module, Next does not give it the module — it
 * gives it a client-reference proxy, so that React can send a
 * placeholder to the browser and let the real thing hydrate there.
 * For a COMPONENT that is exactly right. For a plain string, number or
 * function it is silently wrong: the server gets an object that is not
 * the value, and the code carries on with it.
 *
 * That is not hypothetical. The root layout read the language cookie's
 * name from `language-picker.tsx`:
 *
 *     import { LOCALE_COOKIE } from "@/components/site/language-picker";
 *     ...
 *     resolveLocale(jar.get(LOCALE_COOKIE)?.value)
 *
 * so every request looked up a cookie by the wrong name, found
 * nothing, and rendered English. Choosing a language did nothing, for
 * anyone, forever. It type-checked — the types were right, only the
 * runtime value was not — and it slipped past unit tests on both
 * sides, because the bug was in the seam between them rather than in
 * either half.
 *
 * THE RULE: an import out of a client module into a server file may
 * only bind names shaped like a React component — a capital followed
 * by a lower-case letter or digit, as in `LanguagePicker` or `Img`.
 * Components cross the boundary; constants, helpers and hooks do not.
 * Types are free either way — `import type` is erased before any of
 * this matters.
 *
 * "Starts with a capital" is NOT enough, and the first version of this
 * check made exactly that mistake: `LOCALE_COOKIE` starts with a
 * capital, so the rule waved through the very import it was written
 * to catch. SCREAMING_SNAKE_CASE is a constant, not a component.
 *
 * Shared constants belong in a module with no "use client" at all,
 * which both sides can import honestly. `src/lib/i18n-core.ts` exists
 * for exactly that reason.
 *
 * Exits non-zero, so it can sit in CI beside `typecheck`.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === "node_modules" || name.startsWith(".")) continue;
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.tsx?$/.test(name) && !/\.d\.ts$/.test(name)) yield full;
  }
}

/** The directive has to be the first statement, so only the top matters. */
function isClientModule(file: string): boolean {
  const head = readFileSync(file, "utf8").slice(0, 400);
  return /^\s*(\/\*[\s\S]*?\*\/\s*)?["']use client["']/.test(head);
}

/** "@/lib/x" and "./x" both resolve to a file on disk, or to nothing. */
function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null; // a package, not ours
  for (const c of [base + ".ts", base + ".tsx", path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (existsSync(c)) return c;
  }
  return null;
}

interface Offence {
  file: string;
  line: number;
  from: string;
  names: string[];
}

const IMPORT = /^import\s+(type\s+)?({[^}]*}|[A-Za-z0-9_$]+)?[^"']*from\s*["']([^"']+)["']/gm;

function bindings(clause: string): { names: string[]; typeOnly: boolean } {
  if (!clause.startsWith("{")) return { names: [clause], typeOnly: false };
  const names: string[] = [];
  for (let part of clause.slice(1, -1).split(",")) {
    part = part.trim();
    if (!part) continue;
    // `type Foo` inside the braces is erased too.
    if (/^type\s/.test(part)) continue;
    const as = part.split(/\s+as\s+/);
    names.push((as[1] ?? as[0]).trim());
  }
  return { names, typeOnly: false };
}

const offences: Offence[] = [];
let serverFiles = 0;
let crossings = 0;

for (const file of walk(SRC)) {
  if (isClientModule(file)) continue;
  serverFiles += 1;
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(IMPORT)) {
    if (m[1]) continue; // `import type ...`
    const clause = m[2];
    if (!clause) continue;
    const target = resolveImport(file, m[3]);
    if (!target || !isClientModule(target)) continue;
    crossings += 1;
    const { names } = bindings(clause);
    // PascalCase only: a capital THEN a lower-case letter or digit.
    // `LOCALE_COOKIE` and `MAX` are constants and must not pass.
    const bad = names.filter((n) => !/^[A-Z][a-z0-9]/.test(n));
    if (bad.length) {
      offences.push({
        file: path.relative(ROOT, file),
        line: src.slice(0, m.index ?? 0).split("\n").length,
        from: m[3],
        names: bad,
      });
    }
  }
}

console.log(
  `Checked ${serverFiles} server files; ${crossings} import from a client module.`,
);

// A tally line in the sweep's shape, so this reads like every other
// check rather than sitting blank beside them.
console.log(`${crossings - offences.length} passed, ${offences.length} failed`);

if (!offences.length) {
  console.log("No server file takes a plain value out of a client module.");
  process.exit(0);
}

console.log(`\n${offences.length} crossing(s) that will not survive the boundary:\n`);
for (const o of offences) {
  console.log(`  ${o.file}:${o.line}`);
  console.log(`    imports ${o.names.join(", ")} from "${o.from}" ("use client")`);
  console.log(
    `    The server gets a client-reference proxy, not the value. Move ${
      o.names.length > 1 ? "these" : "it"
    } into a module\n    without "use client" and import from there.\n`,
  );
}
process.exit(1);
