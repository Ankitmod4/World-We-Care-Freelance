import { env } from "@/config/env";

/** The backend returns uploads as site-relative paths ("/uploads/..."). */
export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${env.apiUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
