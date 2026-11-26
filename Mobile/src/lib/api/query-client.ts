import { QueryClient, focusManager } from "@tanstack/react-query";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { isApiError } from "./errors";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // Never retry 4xx (auth/validation); retry network and 5xx errors twice.
      retry: (count, error) => {
        if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
        return count < 2;
      },
    },
    mutations: { retry: false },
  },
});

/** Refetch stale queries when the app comes back to the foreground. */
export function bindAppFocus() {
  const onChange = (status: AppStateStatus) => {
    if (Platform.OS !== "web") focusManager.setFocused(status === "active");
  };
  const sub = AppState.addEventListener("change", onChange);
  return () => sub.remove();
}
