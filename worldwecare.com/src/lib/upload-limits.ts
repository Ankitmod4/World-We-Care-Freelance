/**
 * Upload limits — one source of truth.
 *
 * Two different kinds of limit live here and they are not the same
 * thing:
 *
 *  • BODY_LIMIT_MB is a BUILD-TIME ceiling. Next reads
 *    `middlewareClientMaxBodySize` from next.config at build, and a
 *    body past it is SILENTLY TRUNCATED rather than rejected — the
 *    sister project shipped corrupt files for weeks because of exactly
 *    that. It cannot be changed from the admin UI; it needs an env var
 *    and a rebuild.
 *
 *  • The admin-editable limits (`storage.maxVideoMB`,
 *    `storage.maxVideoSeconds`, `storage.maxFileMB`) live in
 *    platform_settings and take effect on the next upload.
 *
 * The admin limit must stay under the build-time ceiling, which is why
 * the settings form validates against BODY_LIMIT_MB rather than a
 * number someone typed into a component.
 *
 * This module is imported by next.config.ts, so it must not import
 * anything — no prisma, no node built-ins with side effects.
 */

/** Build-time request body ceiling, in MB. Raise with MAX_UPLOAD_BODY_MB. */
export const BODY_LIMIT_MB = (() => {
  const raw = Number(process.env.MAX_UPLOAD_BODY_MB);
  return Number.isFinite(raw) && raw >= 16 && raw <= 64 * 1024 ? Math.floor(raw) : 2048;
})();

/**
 * What next.config passes to Next. A margin above the ceiling so the
 * app's own size check is what rejects an oversized upload, never the
 * silent truncation.
 */
export const BODY_LIMIT_CONFIG = `${BODY_LIMIT_MB + 256}mb`;

/** Used when the setting has never been written. */
export const DEFAULT_MAX_VIDEO_MB = 512;
/** 0 means "no limit". */
export const DEFAULT_MAX_VIDEO_SECONDS = 0;
export const DEFAULT_MAX_FILE_MB = 8;

export interface StorageLimits {
  maxVideoMB: number;
  maxVideoSeconds: number;
  maxFileMB: number;
  bodyLimitMB: number;
}

/** Clamp whatever is in the settings row to something sane. */
export function normaliseLimits(input: {
  maxVideoMB?: unknown;
  maxVideoSeconds?: unknown;
  maxFileMB?: unknown;
}): StorageLimits {
  const num = (v: unknown, fallback: number) => {
    // `Number(null)` is 0, and a settings row that was cleared reads
    // back as null — without this an unset max would clamp to 1 MB and
    // block every upload. Same for "" and undefined.
    if (v === null || v === undefined || v === "") return fallback;
    const n = typeof v === "string" ? Number.parseInt(v, 10) : Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
  };
  return {
    maxVideoMB: Math.min(
      BODY_LIMIT_MB,
      Math.max(1, num(input.maxVideoMB, DEFAULT_MAX_VIDEO_MB)),
    ),
    maxVideoSeconds: Math.max(0, num(input.maxVideoSeconds, DEFAULT_MAX_VIDEO_SECONDS)),
    maxFileMB: Math.min(1024, Math.max(1, num(input.maxFileMB, DEFAULT_MAX_FILE_MB))),
    bodyLimitMB: BODY_LIMIT_MB,
  };
}
