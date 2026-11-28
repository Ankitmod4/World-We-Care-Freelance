/**
 * Runtime configuration. Only EXPO_PUBLIC_* variables are available in the app
 * bundle, so nothing secret may ever live here.
 */
import { Platform } from "react-native";

const rawApiUrl = process.env.EXPO_PUBLIC_API_URL;

/**
 * Expo web (dev only): call the API on the same hostname the page is served
 * from, so the session cookie is same-site (e.g. localhost:8081 → localhost:3000).
 * Native builds use EXPO_PUBLIC_API_URL unchanged.
 */
function resolveApiUrl(url: string): string {
  if (Platform.OS !== "web" || typeof window === "undefined") return url;
  try {
    const u = new URL(url);
    u.hostname = window.location.hostname;
    return u.toString();
  } catch {
    return url;
  }
}

if (!rawApiUrl && __DEV__) {
  console.warn("EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env.local.");
}

export const env = {
  /** Backend base URL without a trailing slash, e.g. https://example.com */
  apiUrl: resolveApiUrl(rawApiUrl ?? "http://localhost:3000").replace(/\/+$/, ""),
  /** Request timeout in milliseconds. */
  requestTimeoutMs: 20_000,
} as const;
