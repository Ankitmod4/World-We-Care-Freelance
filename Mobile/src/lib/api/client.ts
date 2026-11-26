/**
 * The one HTTP client for the backend.
 *
 * Auth: the backend uses HttpOnly cookies (wwc-user-session, wwc-user-verified).
 * React Native's native networking stores and resends cookies per host
 * automatically, so every request uses `credentials: "include"` and the app never
 * touches the token itself. If the backend later adds bearer tokens, only this
 * file changes (see README → Auth).
 */
import { env } from "@/config/env";
import { ApiError } from "./errors";

export type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Query;
  /** Plain object → JSON. FormData → multipart (uploads). */
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** "json" (default) parses the body; "none" ignores it (e.g. logout's 303 redirect). */
  parse?: "json" | "none";
}

type UnauthorizedListener = () => void;
let onUnauthorized: UnauthorizedListener | null = null;

/** Registered once by the session store, so any 401 signs the user out everywhere. */
export function setUnauthorizedHandler(fn: UnauthorizedListener | null) {
  onUnauthorized = fn;
}

export function buildUrl(path: string, query?: Query): string {
  const url = `${env.apiUrl}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return qs ? `${url}?${qs}` : url;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", query, body, headers, signal, parse = "json" } = opts;

  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.requestTimeoutMs);
  signal?.addEventListener("abort", () => controller.abort());

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, "Network request failed");
  } finally {
    clearTimeout(timer);
  }

  if (parse === "none" && res.status < 400) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null; // HTML error page or empty body
    }
  }

  if (!res.ok) {
    const errBody = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    const message = typeof errBody?.error === "string" ? errBody.error : `Request failed (${res.status})`;
    const error = new ApiError(res.status, message, errBody);
    if (error.isUnauthorized) onUnauthorized?.();
    throw error;
  }

  return data as T;
}

/** Shorthand helpers used by the feature `api/` files. */
export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: "DELETE", body }),
};
