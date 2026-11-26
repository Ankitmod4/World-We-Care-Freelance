/**
 * Design tokens. Colours mirror the web app's default "Sky" theme
 * (worldwecare.com/src/lib/theming.ts) so both apps look like one product.
 * Components read colours from `useTheme()`, never from hex literals.
 */
const sky = {
  light: {
    brand: "#1777b8",
    brandHover: "#005f9e",
    onBrand: "#ffffff",
    brandSoft: "#d6efff",
    brandTint: "#edf8ff",
    brandInk: "#005189",
    accent: "#c47131",
    onAccent: "#ffffff",
    accentSoft: "#ffe7d2",
    accentInk: "#863f00",
    surface: "#ffffff",
    surfaceMuted: "#f8fafc",
    surfaceHover: "#f1f5f9",
    border: "#e2e8f0",
    borderSoft: "#f1f5f9",
    borderStrong: "#c8d2df",
    text: "#0f172a",
    textMuted: "#64748b",
    textSubtle: "#7e8da3",
    ground: "#f8fafc",
    success: "#1f7a4d",
    successSoft: "#e3f4ea",
    warning: "#96650a",
    warningSoft: "#fbeed6",
    danger: "#c4342f",
    onDanger: "#ffffff",
    dangerSoft: "#fbe6e4",
    dangerInk: "#9c2621",
  },
  dark: {
    brand: "#5ca5e1",
    brandHover: "#7cbbf0",
    onBrand: "#13100d",
    brandSoft: "#133047",
    brandTint: "#132331",
    brandInk: "#92cbfb",
    accent: "#e69a64",
    onAccent: "#13100d",
    accentSoft: "#442916",
    accentInk: "#fcbf95",
    surface: "#161a26",
    surfaceMuted: "#1c2030",
    surfaceHover: "#232838",
    border: "#232838",
    borderSoft: "#1c2030",
    borderStrong: "#343a58",
    text: "#e2e8f0",
    textMuted: "#94a3b8",
    textSubtle: "#64748b",
    ground: "#0b0d14",
    success: "#5cbf8a",
    successSoft: "#173026",
    warning: "#d9a447",
    warningSoft: "#332813",
    danger: "#e8756d",
    onDanger: "#0f0d0b",
    dangerSoft: "#331a19",
    dangerInk: "#f4a49e",
  },
} as const;

export type ColorScheme = "light" | "dark";
export type ThemeColors = { [K in keyof typeof sky.light]: string };

export const palettes: Record<ColorScheme, ThemeColors> = sky;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;

export const typography = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 23, fontWeight: "400" },
  label: { fontSize: 14, lineHeight: 19, fontWeight: "600" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
} as const;

export type TypographyVariant = keyof typeof typography;
