"use client";

/**
 * The member's colour theme and light/dark mode.
 *
 * THIS FILE USED TO WRITE TO THE DOM DIRECTLY, AND THAT WAS A BUG.
 * It set `document.getElementById("wwc-theme").textContent` and moved
 * on. The write works — the browser re-parses a <style> the moment
 * its text changes — but React owns that element, and React 19
 * compares `dangerouslySetInnerHTML` by object identity. `{__html: s}`
 * is a new object on every render, so ANY unrelated re-render above
 * the style tag rewrites it back to whatever the server sent. The
 * "Colour saved" toast was such a re-render: the page changed colour
 * and then changed straight back, about 100ms later, which reads as
 * "nothing happened until I refreshed".
 *
 * So the state lives in React now, in the shell, and the style tag is
 * rendered from it. There is nothing left to clobber. The rule this
 * leaves behind: if you find yourself reaching for getElementById to
 * change something React rendered, the state is in the wrong place.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  THEMES,
  DEFAULT_THEME_ID,
  toneSwatches,
  appearanceAttribute,
  buildThemeStyleBlock,
  type AppearanceMode,
} from "@/lib/theming";
import { useT } from "./locale-context";
import type { TFunction } from "@/lib/i18n-core";

/* ── the state ─────────────────────────────────────────────────── */

export interface Appearance {
  colorThemeId: string | null;
  mode: AppearanceMode;
  /** How deep the chosen colour runs. 0 lightest … 4 darkest. */
  tone: number;
  /** "light" or "dark" as it is actually rendering right now. */
  resolved: "light" | "dark";
  /** The CSS the shell renders. */
  styleBlock: string;
  /** What goes on data-appearance; null for system. */
  attribute: "light" | "dark" | null;
  /** Both repaint immediately and resolve with whether the save stuck. */
  setTheme: (id: string) => Promise<boolean>;
  setMode: (mode: AppearanceMode) => Promise<boolean>;
  setTone: (tone: number) => Promise<boolean>;
}

const AppearanceContext = createContext<Appearance | null>(null);

async function save(body: {
  colorThemeId?: string;
  appearanceMode?: AppearanceMode;
  brandTone?: number;
}): Promise<boolean> {
  const res = await fetch("/api/user/settings/appearance", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  return !!res?.ok;
}

/**
 * Owns the preference. Called once, by the shell.
 *
 * Seeded from the server on every mount, which is also how a change
 * made on one tab reaches the others — they pick it up on their next
 * navigation rather than needing to be told.
 *
 * A FAILED SAVE DOES NOT REVERT. Snapping the whole interface back
 * because a request timed out is worse than a preference that quietly
 * did not persist, and the caller is told so it can say as much. The
 * next page load is where it corrects itself, which is the moment it
 * actually matters.
 */
export function useAppearanceState(initial: {
  colorThemeId: string | null;
  mode: AppearanceMode;
  tone: number;
}): Appearance {
  const [colorThemeId, setColorThemeId] = useState(initial.colorThemeId);
  const [mode, setModeState] = useState(initial.mode);
  const [tone, setToneState] = useState(initial.tone);

  // Only consulted when the mode is "system"; kept in state rather
  // than read during render so SSR and the first client render agree.
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const setTheme = useCallback((id: string) => {
    setColorThemeId(id);
    return save({ colorThemeId: id });
  }, []);

  const setMode = useCallback((next: AppearanceMode) => {
    setModeState(next);
    return save({ appearanceMode: next });
  }, []);

  const setTone = useCallback((next: number) => {
    setToneState(next);
    return save({ brandTone: next });
  }, []);

  // ~3KB of string building. Cheap, but it would otherwise run on
  // every keystroke in every form inside the shell.
  const styleBlock = useMemo(
    () => buildThemeStyleBlock(colorThemeId, tone),
    [colorThemeId, tone],
  );

  return useMemo(
    () => ({
      colorThemeId,
      mode,
      tone,
      resolved: mode === "system" ? (systemDark ? "dark" : "light") : mode,
      styleBlock,
      attribute: appearanceAttribute(mode),
      setTheme,
      setMode,
      setTone,
    }),
    [colorThemeId, mode, tone, systemDark, styleBlock, setTheme, setMode, setTone],
  );
}

export function AppearanceProvider({
  value,
  children,
}: {
  value: Appearance;
  children: React.ReactNode;
}) {
  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

/**
 * Null outside the shell — on the marketing pages, the login form and
 * every public profile, which have no preference to read and are
 * always the light default. Consumers there must cope rather than
 * crash, so this does not throw.
 */
export function useAppearance(): Appearance | null {
  return useContext(AppearanceContext);
}

/**
 * "light" or "dark", for the things that cannot read a CSS variable —
 * map tiles, and any third-party widget with its own switch.
 * Always "light" where there is no shell.
 */
export function useResolvedAppearance(): "light" | "dark" {
  return useAppearance()?.resolved ?? "light";
}

/* ── the mode toggle, for the header menu and the drawer ───────── */

/**
 * Literal `t()` calls, so the extractor can see them — a
 * `t(mode.labelKey, mode.label)` is invisible to it. See header-nav.
 */
function modeLabels(t: TFunction): Record<AppearanceMode, string> {
  return {
    light: t("appearance.light", "Light"),
    system: t("appearance.auto", "Auto"),
    dark: t("appearance.dark", "Dark"),
  };
}

/** The five tone steps, likewise declared literally. */
function toneLabels(t: TFunction): string[] {
  return [
    t("appearance.toneLightest", "Lightest"),
    t("appearance.toneLight", "Light"),
    t("appearance.toneDefault", "Default"),
    t("appearance.toneDeep", "Deep"),
    t("appearance.toneDeepest", "Deepest"),
  ];
}

const MODES: { id: AppearanceMode; icon: React.ReactNode }[] = [
  {
    id: "light",
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
      </>
    ),
  },
  {
    id: "system",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </>
    ),
  },
  {
    id: "dark",
    icon: <path d="M20 13.5A8 8 0 0110.5 4a7 7 0 109.5 9.5z" />,
  },
];

/**
 * Light / Auto / Dark, as a segmented control of three icons.
 *
 * All three are shown at once rather than one button that cycles,
 * because "Auto" is invisible on a cycling button: someone on system
 * mode at night sees a moon, assumes they picked dark, and then
 * wonders why it went light in the morning. Three segments make the
 * third state exist.
 *
 * ICONS ONLY. The words were there first and did not fit: the header
 * dropdown is 224px wide, and sun+"Light" / monitor+"Auto" /
 * moon+"Dark" needs about 214px of content inside 200px of usable
 * width, so "Dark" was clipped by the menu's edge. Shrinking the type
 * or the padding to claw back fourteen pixels would have left a
 * control that was one longer translation away from breaking again.
 *
 * The words are still there for anyone who needs them — `aria-label`
 * for a screen reader, `title` for a hover — and the Settings row
 * that hosts this control names all three in its hint, which is
 * where someone deliberately configuring will read them.
 */
export function AppearanceToggle({
  onSaved,
  className,
}: {
  onSaved?: (mode: AppearanceMode, ok: boolean) => void;
  className?: string;
}) {
  const t = useT();
  const labels = modeLabels(t);
  const appearance = useAppearance();
  if (!appearance) return null;
  const { mode, setMode } = appearance;

  return (
    <div
      role="radiogroup"
      aria-label={t("settings.appearance", "Appearance")}
      className={
        "flex items-center gap-0.5 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-0.5 " +
        (className ?? "")
      }
    >
      {MODES.map((m) => {
        const on = m.id === mode;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              if (on) return;
              void setMode(m.id).then((ok) => onSaved?.(m.id, ok));
            }}
            title={labels[m.id]}
            aria-label={labels[m.id]}
            className={
              // min-w-9 is doing real work. `flex-1` is `flex: 1 1 0%`,
              // so each segment's BASIS IS ZERO — fine inside the
              // fixed-width header dropdown, where there is a definite
              // width to divide up, and broken in the Settings row,
              // whose action slot is sized by its content. Three
              // zero-basis children make the pill collapse to a few
              // pixels and the icons draw on top of each other. The
              // floor gives the control an intrinsic size to be
              // measured at; flex-1 still stretches it where there is
              // room to.
              "flex h-8 min-w-9 flex-1 items-center justify-center rounded-full transition-colors " +
              (on
                ? "bg-[color:var(--color-surface)] text-[color:var(--color-text)] shadow-card"
                : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]")
            }
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {m.icon}
            </svg>
          </button>
        );
      })}
    </div>
  );
}

/* ── the tone picker, for the settings page ────────────────────── */

/**
 * Five steps of the CHOSEN colour, lightest to darkest.
 *
 * Second axis, not a thirteenth theme: the member has already said
 * which colour they want, and this says how deep it runs. The swatches
 * are the real `brand` values each step produces — computed by the
 * same `applyTone` the stylesheet uses, so a swatch cannot advertise a
 * colour the page will not actually render.
 *
 * Previewed in the half the member is looking at, for the same reason
 * the palette picker is: a row of light swatches on a dark page is a
 * control showing five things, none of which are what you will get.
 */
export function TonePicker({
  onSaved,
}: {
  onSaved?: (tone: number, ok: boolean) => void;
}) {
  const t = useT();
  const tones = toneLabels(t);
  const appearance = useAppearance();
  if (!appearance) return null;
  const { tone, resolved, colorThemeId, setTone } = appearance;
  const swatches = toneSwatches(colorThemeId, resolved);

  return (
    <>
    <div role="radiogroup" aria-label={t("appearance.toneGroup", "Colour tone")} className="grid grid-cols-5 gap-1.5 sm:gap-2">
      {swatches.map((hex, i) => {
        const on = i === tone;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={tones[i]}
            title={tones[i]}
            onClick={() => {
              if (on) return;
              void setTone(i).then((ok) => onSaved?.(i, ok));
            }}
            className={
              "flex flex-col items-center gap-2 rounded-xl border px-1 py-2.5 transition-colors " +
              (on
                ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)]"
                : "border-[color:var(--color-border-soft)] hover:border-[color:var(--color-border-strong)]")
            }
          >
            <span
              className="block h-7 w-7 rounded-full"
              style={{ background: hex }}
              aria-hidden
            />
            <span
              className={
                "text-[11px] font-medium " +
                (on
                  ? "text-[color:var(--color-brand-ink)]"
                  : "text-[color:var(--color-text-subtle)]")
              }
            >
              {tones[i]}
            </span>
          </button>
        );
      })}
    </div>

    <TonePreview />
    </>
  );
}

/**
 * What the tone actually changes, gathered in one place.
 *
 * Not a mock-up: every colour below is the live CSS variable, so this
 * repaints with the rest of the page the moment a tone is picked. The
 * point is not to preview a change you haven't made — the change is
 * instant — it is that the four things a tone touches (a button, a
 * link in a sentence, a chip, the accent) are otherwise scattered
 * across the site, and judging a colour means hunting for them.
 */
function TonePreview() {
  const t = useT();
  return (
    <div
      aria-hidden
      className="mt-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-4"
    >
      <p className="text-[14px] font-semibold leading-snug text-[color:var(--color-text)]">
        {t("landing.topicSobriety", "Sobriety")}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-text-muted)]">
        {t("appearance.previewLine", "Read for as long as you need.")}{" "}
        <span className="font-medium text-[color:var(--color-brand)] underline underline-offset-2">
          {t("appearance.previewLink", "A link looks like this.")}
        </span>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[color:var(--color-brand-soft)] px-2.5 py-1 text-[11.5px] font-semibold text-[color:var(--color-brand-ink)]">
          {t("appearance.previewMembers", "{n} members", { n: 12 })}
        </span>
        <span className="rounded-full bg-[color:var(--color-accent-soft)] px-2.5 py-1 text-[11.5px] font-semibold text-[color:var(--color-accent-ink)]">
          {t("appearance.previewPeer", "Peer supported")}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span className="rounded-full border border-[color:var(--color-border)] px-3 py-1.5 text-[12.5px] font-medium text-[color:var(--color-text)]">
            {t("appearance.previewLater", "Later")}
          </span>
          <span className="rounded-full bg-[color:var(--color-brand)] px-3.5 py-1.5 text-[12.5px] font-semibold text-[color:var(--color-on-brand)]">
            {t("chat.join", "Join")}
          </span>
        </span>
      </div>
    </div>
  );
}

/* ── the palette picker, for the settings page ─────────────────── */

/**
 * One swatch per theme.
 *
 * Each shows the theme it names — its own card, its own border, its
 * brand and its accent — rather than a dot of brand on the CURRENT
 * theme's card. That is the difference between a picker you can
 * choose from and one you have to try on: the neutrals are most of
 * what a theme changes, and a dot hides exactly that.
 *
 * The page colour behind the little card is deliberately the SAME in
 * every swatch, because `ground` is no longer themed (theming.ts,
 * note 5). The swatches therefore look closer together than they used
 * to — which is the honest preview, not a regression.
 *
 * The swatches are drawn from the same token table the app runs on,
 * so a swatch cannot drift from the theme it advertises.
 */
export function ThemePicker({
  onSaved,
}: {
  onSaved?: (themeId: string, ok: boolean) => void;
}) {
  const t = useT();
  const appearance = useAppearance();
  if (!appearance) return null;
  const { colorThemeId, resolved, setTheme } = appearance;
  const selected = colorThemeId ?? DEFAULT_THEME_ID;

  return (
    <div
      role="radiogroup"
      aria-label={t("settings.colourTheme", "Colour theme")}
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
    >
      {THEMES.map((theme) => {
        // Preview the half the member is actually in. A row of light
        // swatches on a dark page is a picker showing you a dozen
        // things, none of which are what you will get.
        const t = theme[resolved];
        const on = theme.id === selected;
        return (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              if (on) return;
              void setTheme(theme.id).then((ok) => onSaved?.(theme.id, ok));
            }}
            title={theme.blurb}
            className={
              "group overflow-hidden rounded-xl border text-left transition-shadow " +
              (on
                ? "border-[color:var(--color-brand)] shadow-card ring-2 ring-[color:var(--color-brand)]/25"
                : "border-[color:var(--color-border)] hover:shadow-card")
            }
          >
            {/* A tiny page: ground, a card on it, a filled button and
                an accent pip. Inline styles, not classes — these are
                another theme's colours, not the running one's. */}
            <span
              className="flex h-16 items-end gap-1.5 p-2"
              style={{ background: t.ground }}
            >
              <span
                className="flex h-full flex-1 flex-col justify-end gap-1 rounded-md p-1.5"
                style={{ background: t.surface, border: `1px solid ${t.border}` }}
              >
                <span
                  className="block h-1 w-3/4 rounded-full"
                  style={{ background: t.textMuted }}
                />
                <span className="flex items-center gap-1">
                  <span
                    className="block h-2.5 w-6 rounded-full"
                    style={{ background: t.brand }}
                  />
                  <span
                    className="block h-2.5 w-2.5 rounded-full"
                    style={{ background: t.accent }}
                  />
                </span>
              </span>
            </span>
            <span
              className={
                "flex items-center justify-between gap-1 border-t px-2.5 py-2 text-[12.5px] font-medium " +
                (on
                  ? "border-[color:var(--color-brand)]/20 bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-ink)]"
                  : "border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] text-[color:var(--color-text)]")
              }
            >
              {theme.name}
              {on && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M4 12.5l5 5L20 6.5" />
                </svg>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
