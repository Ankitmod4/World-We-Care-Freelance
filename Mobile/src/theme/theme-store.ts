import { create } from "zustand";

/**
 * Appearance preference. Matches the backend's `appearanceMode`
 * (PATCH /api/user/settings/appearance). The web defaults members to dark,
 * so the app does the same until the user picks something else.
 */
export type AppearanceMode = "light" | "dark" | "system";

interface ThemeState {
  mode: AppearanceMode;
  setMode: (mode: AppearanceMode) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "dark",
  setMode: (mode) => set({ mode }),
}));
