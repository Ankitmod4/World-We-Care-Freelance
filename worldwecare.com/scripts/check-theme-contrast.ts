#!/usr/bin/env tsx
/**
 * Re-checks every colour the app can render against WCAG AA.
 *
 * IT IMPORTS THE REAL MODULE NOW. It used to parse theming.ts as text
 * and rebuild the palettes from a regex, which meant it was checking
 * its own reading of the file rather than what the app ships. Since
 * `applyTone` derives colours at runtime — the tone picker's five
 * steps are computed, not written down — a text parser could not have
 * seen them at all.
 *
 * The matrix: every theme, both modes, every tone. Twelve themes and
 * five tones is a hundred and twenty palettes, and nobody eyeballs a
 * hundred and twenty palettes.
 *
 * Run it after touching any colour, or `applyTone`. `npm run theme:check`.
 *
 * The thresholds are not all 4.5. Body text is 4.5 because that is
 * what AA asks for. Placeholder-weight text (`textSubtle`) is 3.0,
 * because AA exempts text that is decorative or duplicated elsewhere,
 * and holding it to 4.5 would collapse it into `textMuted` and lose
 * the third step entirely. Button labels are 3.0 against their fill
 * for the same reason large/bold text is: they are 13px semibold on a
 * solid block, and 4.5 there forces every brand into near-black.
 * Borders are checked for VISIBILITY (1.18), not readability — a
 * border you cannot see is the actual bug, and it is the one that
 * made the old palette feel flat.
 */

import {
  THEMES,
  STATUS,
  applyTone,
  TONE_LABELS,
  type ThemeTokens,
} from "../src/lib/theming";

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a 6-digit hex: ${hex}`);
  const n = Number.parseInt(m[1], 16);
  return (
    0.2126 * srgbToLinear((n >> 16) & 255) +
    0.7152 * srgbToLinear((n >> 8) & 255) +
    0.0722 * srgbToLinear(n & 255)
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const failures: string[] = [];
let checks = 0;

function need(label: string, fg: string, bg: string, min: number): void {
  checks++;
  const ratio = contrast(fg, bg);
  if (ratio + 1e-9 < min) {
    failures.push(`${label}: ${fg} on ${bg} = ${ratio.toFixed(2)}, need ${min}`);
  }
}

function checkPalette(t: ThemeTokens, mode: "light" | "dark", label: string): void {
  const s = STATUS[mode];
  const at = (what: string) => `${label} ${what}`;

  // Body text, on both the card and the page behind it.
  for (const ground of ["surface", "surfaceMuted", "ground"] as const) {
    need(at(`text on ${ground}`), t.text, t[ground], 4.5);
    need(at(`textMuted on ${ground}`), t.textMuted, t[ground], 4.5);
    need(at(`textSubtle on ${ground}`), t.textSubtle, t[ground], 3.0);
  }

  // Button labels. The label travels with the fill and must clear both
  // the resting fill and the hover fill, because it does not change on
  // hover.
  need(at("onBrand on brand"), t.onBrand, t.brand, 3.0);
  need(at("onBrand on brandHover"), t.onBrand, t.brandHover, 3.0);
  need(at("onAccent on accent"), t.onAccent, t.accent, 3.0);

  // Chip labels: the ink that goes on each soft/tint background.
  need(at("brandInk on brandSoft"), t.brandInk, t.brandSoft, 4.5);
  need(at("brandInk on brandTint"), t.brandInk, t.brandTint, 4.5);
  need(at("accentInk on accentSoft"), t.accentInk, t.accentSoft, 4.5);
  need(at("text on brandTint"), t.text, t.brandTint, 4.5);

  // Status chips, against this theme's surfaces and their own softs.
  need(at("successInk on successSoft"), s.successInk, s.successSoft, 4.5);
  need(at("warningInk on warningSoft"), s.warningInk, s.warningSoft, 4.5);
  need(at("dangerInk on dangerSoft"), s.dangerInk, s.dangerSoft, 4.5);
  for (const ground of ["surface", "surfaceMuted"] as const) {
    need(at(`success on ${ground}`), s.success, t[ground], 3.0);
    need(at(`warning on ${ground}`), s.warning, t[ground], 3.0);
    need(at(`danger on ${ground}`), s.danger, t[ground], 3.0);
  }
  need(at("onSuccess on success"), s.onSuccess, s.success, 3.0);
  need(at("onWarning on warning"), s.onWarning, s.warning, 3.0);
  need(at("onDanger on danger"), s.onDanger, s.danger, 3.0);

  // Borders must be SEEN, not read.
  need(at("border vs surface"), t.border, t.surface, 1.18);
  need(at("borderStrong vs surface"), t.borderStrong, t.surface, 1.5);

  // The brand has to be findable on the page, not just legible on a
  // button — a link-coloured word in a paragraph is this pair. It is
  // also the constraint that caps how pale a light tone may go.
  need(at("brand on surface"), t.brand, t.surface, 3.0);
}

for (const theme of THEMES) {
  const before = failures.length;
  for (const mode of ["light", "dark"] as const) {
    for (let tone = 0; tone < TONE_LABELS.length; tone++) {
      checkPalette(
        applyTone(theme[mode], tone),
        mode,
        `${theme.id}/${mode}/${TONE_LABELS[tone].toLowerCase()}`,
      );
    }
  }
  const bad = failures.length - before;
  console.log(`  ${theme.id.padEnd(10)}${bad === 0 ? "ok" : `${bad} FAILING`}`);
}

const palettes = THEMES.length * 2 * TONE_LABELS.length;
console.log(
  `\n${checks} pairs checked across ${THEMES.length} themes x 2 modes x ${TONE_LABELS.length} tones (${palettes} palettes).`,
);

if (failures.length > 0) {
  console.error(`\n${failures.length} failing:\n`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log("All pass.");
