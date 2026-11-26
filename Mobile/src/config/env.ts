/**
 * Runtime configuration. Only EXPO_PUBLIC_* variables are available in the app
 * bundle, so nothing secret may ever live here.
 */
const rawApiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!rawApiUrl && __DEV__) {
  console.warn("EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env.local.");
}

export const env = {
  /** Backend base URL without a trailing slash, e.g. https://example.com */
  apiUrl: (rawApiUrl ?? "http://localhost:3000").replace(/\/+$/, ""),
  /** Request timeout in milliseconds. */
  requestTimeoutMs: 20_000,
} as const;
