import { useColorScheme } from "react-native";
import { palettes, radius, spacing, typography, type ColorScheme } from "./tokens";
import { useThemeStore } from "./theme-store";

export function useColorSchemeResolved(): ColorScheme {
  const system = useColorScheme();
  const mode = useThemeStore((s) => s.mode);
  if (mode === "system") return system === "light" ? "light" : "dark";
  return mode;
}

/** The single way components get colours and sizes. */
export function useTheme() {
  const scheme = useColorSchemeResolved();
  return { scheme, colors: palettes[scheme], spacing, radius, typography };
}

export type Theme = ReturnType<typeof useTheme>;
export { useThemeStore, type AppearanceMode } from "./theme-store";
export * from "./tokens";
