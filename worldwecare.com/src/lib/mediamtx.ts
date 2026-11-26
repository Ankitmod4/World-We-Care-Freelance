/**
 * The MediaMTX server, as this app sees it.
 *
 * MediaMTX runs on its own host. Three channels connect it to us, and
 * they are deliberately different:
 *
 *   1. THIS FILE — the app calls MediaMTX's Control API over the
 *      network to turn recording on and off and to kick a session.
 *      Authenticated with an API user, so the credentials live in
 *      platform settings and never reach a browser.
 *
 *   2. THE AUTH HOOK — MediaMTX calls US, once per publish and once
 *      per read, to ask whether it should allow them. That is
 *      `/api/mediamtx/auth`, and it is the entire access-control
 *      story for private sessions.
 *
 *   3. THE BROWSER — publishes with WHIP and reads with WHEP,
 *      straight to MediaMTX, carrying a grant token in an
 *      Authorization header. Media never passes through this app.
 *
 * Everything here fails closed. A MediaMTX that is unreachable must
 * never read as "recording is on".
 */

import { getSetting } from "./settings";

export interface MediamtxConfig {
  /** Public origin the browser hits for WHIP/WHEP/HLS, e.g. https://stream.worldwecare.com */
  publicUrl: string;
  /**
   * Scopes every path under one directory, e.g. "live/". Has to match
   * the regex in mediamtx.yml — the media server refuses a path that
   * matches no entry, so a prefix set here and not there means every
   * broadcast fails with "path not found".
   *
   * Normalised on read: no leading slash, exactly one trailing slash,
   * or empty.
   */
  pathPrefix: string;
  /** Control API base, reachable from this server only, e.g. https://stream.worldwecare.com:9997 */
  apiUrl: string;
  apiUser: string;
  apiPass: string;
  /** Playback server, for watching a recording back. */
  playbackUrl: string;
  /**
   * Source IPs allowed to call the auth hook. MediaMTX is on a known
   * host; nothing else has any business asking us to authorise a
   * stream.
   */
  allowedIps: string[];
  enabled: boolean;

  /* ── what a broadcaster is allowed ────────────────────────────
     Read when a stream is CREATED and copied onto its row, so
     tightening a limit never cuts off a broadcast already running. */

  /** Minutes before a live broadcast is ended automatically. */
  maxDurationMin: number;
  /** How many broadcasts one member may have running at once. */
  maxConcurrentPerUser: number;
  /** Advisory ceiling handed to the browser's camera constraints. */
  maxHeight: number;
  /** What a new stream defaults to before the owner changes it. */
  defaultVisibility: "PUBLIC" | "UNLISTED";
  /** Whether an unverified member may go live at all. */
  requireEmailVerified: boolean;
  /** Record every broadcast by default. */
  autoRecord: boolean;
  /** Days a recording is kept. 0 means forever. */
  recordingRetentionDays: number;
}

/** Clamp a number setting, so a typo in the admin panel can't uncap it. */
function num(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function getMediamtxConfig(): Promise<MediamtxConfig> {
  const [
    publicUrl, pathPrefix, apiUrl, apiUser, apiPass, playbackUrl, allowedIps, enabled,
    maxDurationMin, maxConcurrentPerUser, maxHeight,
    defaultVisibility, requireEmailVerified, autoRecord, retentionDays,
  ] = await Promise.all([
    getSetting<string>("stream.publicUrl", ""),
    getSetting<string>("stream.pathPrefix", "live/"),
    getSetting<string>("stream.apiUrl", ""),
    getSetting<string>("stream.apiUser", ""),
    getSetting<string>("stream.apiPass", ""),
    getSetting<string>("stream.playbackUrl", ""),
    getSetting<string>("stream.allowedIps", ""),
    getSetting<boolean>("stream.enabled", false),
    getSetting<number>("stream.maxDurationMin", 120),
    getSetting<number>("stream.maxConcurrentPerUser", 1),
    getSetting<number>("stream.maxHeight", 720),
    getSetting<string>("stream.defaultVisibility", "PUBLIC"),
    getSetting<boolean>("stream.requireEmailVerified", true),
    getSetting<boolean>("stream.autoRecord", false),
    getSetting<number>("stream.recordingRetentionDays", 7),
  ]);

  return {
    publicUrl: trimSlash(publicUrl),
    pathPrefix: normalisePrefix(pathPrefix),
    apiUrl: trimSlash(apiUrl),
    apiUser,
    apiPass,
    playbackUrl: trimSlash(playbackUrl),
    allowedIps: allowedIps
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    enabled: enabled === true,

    maxDurationMin: num(maxDurationMin, 120, 5, 1440),
    maxConcurrentPerUser: num(maxConcurrentPerUser, 1, 1, 10),
    maxHeight: num(maxHeight, 720, 240, 2160),
    defaultVisibility: defaultVisibility === "UNLISTED" ? "UNLISTED" : "PUBLIC",
    requireEmailVerified: requireEmailVerified !== false,
    autoRecord: autoRecord === true,
    recordingRetentionDays: num(retentionDays, 7, 0, 3650),
  };
}

/** "" | "live/" — never "/live" or "live" or "//live//". */
export function normalisePrefix(raw: string): string {
  const p = (raw ?? "").trim().replace(/^\/+/, "").replace(/\/+$/, "");
  return p ? `${p}/` : "";
}

function trimSlash(u: string): string {
  return u.trim().replace(/\/+$/, "");
}

/** True when streaming is switched on AND actually configured. */
export function isConfigured(c: MediamtxConfig): boolean {
  return c.enabled && !!c.publicUrl && !!c.apiUrl;
}

/* ── the browser's two URLs ──────────────────────────────────── */

/**
 * Percent-encode each SEGMENT, never the separators between them.
 *
 * `encodeURIComponent` on a whole path turns "live/live-abc" into
 * "live%2Flive-abc", which MediaMTX reads as one path literally named
 * with a slash in it and cannot match — the browser gets a CORS-shaped
 * error because the 404 carries no CORS headers, which sends you
 * looking at the proxy instead of at the URL.
 */
function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function whipUrl(c: MediamtxConfig, path: string): string {
  return `${c.publicUrl}/${encodePath(path)}/whip`;
}

/**
 * The HLS manifest a viewer plays.
 *
 * HLS and not WHEP for broadcasts: WebRTC needs a peer connection per
 * viewer and MediaMTX would carry every one of them, while HLS is a
 * file a CDN or a plain proxy can serve to a thousand people. The
 * cost is a few seconds of latency, which nobody watching a talk
 * notices and everybody in a two-person call would.
 */
export function hlsUrl(c: MediamtxConfig, path: string): string {
  return `${c.publicUrl}/${encodePath(path)}/index.m3u8`;
}

/* ── control API ─────────────────────────────────────────────── */

const TIMEOUT_MS = 6000;

export class MediamtxError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "MediamtxError";
  }
}

/**
 * One request to the Control API.
 *
 * The API password goes in an Authorization header and nowhere else —
 * not the URL, not the error message. A failed call that echoed the
 * request back would put it in a log.
 */
async function call<T>(
  c: MediamtxConfig,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  route: string,
  body?: unknown,
): Promise<T> {
  if (!c.apiUrl) throw new MediamtxError("Streaming server is not configured.");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (c.apiUser || c.apiPass) {
    headers.Authorization =
      "Basic " + Buffer.from(`${c.apiUser}:${c.apiPass}`).toString("base64");
  }
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${c.apiUrl}/v3${route}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
  } catch (err) {
    throw new MediamtxError(
      ctrl.signal.aborted
        ? "Streaming server did not respond in time."
        : `Couldn't reach the streaming server: ${err instanceof Error ? err.message : "network error"}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // MediaMTX returns a plain-text reason. Keep it — it names the
    // path or the field that was wrong — but cap it so a huge error
    // page can't end up in our logs.
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new MediamtxError(
      `Streaming server refused (${res.status})${detail ? `: ${detail}` : ""}`,
      res.status,
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json().catch(() => ({}))) as T;
}

export interface MediamtxPath {
  name: string;
  ready: boolean;
  readyTime: string | null;
  tracks: string[];
  bytesReceived: number;
  bytesSent: number;
  source: { type: string; id: string } | null;
  readers: Array<{ type: string; id: string }>;
}

export async function listPaths(c: MediamtxConfig): Promise<MediamtxPath[]> {
  const d = await call<{ items?: MediamtxPath[] }>(c, "GET", "/paths/list");
  return d.items ?? [];
}

export async function getPath(
  c: MediamtxConfig,
  name: string,
): Promise<MediamtxPath | null> {
  try {
    return await call<MediamtxPath>(c, "GET", `/paths/get/${encodeURIComponent(name)}`);
  } catch (err) {
    if (err instanceof MediamtxError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Turn recording on for a path.
 *
 * Ordinary session paths are served by a regex entry in mediamtx.yml
 * with `record: no`, so there is nothing to patch until we create a
 * concrete entry. Add-then-patch, and treat "already exists" as
 * success — a retried request must not fail.
 */
export async function enableRecording(
  c: MediamtxConfig,
  name: string,
  opts: { segmentDuration?: string; deleteAfter?: string } = {},
): Promise<void> {
  const conf = {
    record: true,
    recordFormat: "fmp4",
    recordSegmentDuration: opts.segmentDuration ?? "1h",
    recordDeleteAfter: opts.deleteAfter ?? "168h",
  };
  try {
    await call(c, "POST", `/config/paths/add/${encodeURIComponent(name)}`, conf);
  } catch (err) {
    // 400 here is nearly always "path already exists".
    if (!(err instanceof MediamtxError) || err.status !== 400) throw err;
    await call(c, "PATCH", `/config/paths/patch/${encodeURIComponent(name)}`, conf);
  }
}

/** Stop recording, and take the concrete path entry away with it. */
export async function disableRecording(c: MediamtxConfig, name: string): Promise<void> {
  try {
    await call(c, "DELETE", `/config/paths/delete/${encodeURIComponent(name)}`);
  } catch (err) {
    // Already gone is the state we wanted.
    if (err instanceof MediamtxError && err.status === 404) return;
    // Deleting the entry is what stops the recording; if that fails,
    // fall back to patching it off rather than leaving it running.
    await call(c, "PATCH", `/config/paths/patch/${encodeURIComponent(name)}`, {
      record: false,
    }).catch(() => {
      throw err;
    });
  }
}

export interface WebrtcSession {
  id: string;
  created: string;
  remoteAddr: string;
  path: string;
  state: "read" | "publish";
  bytesReceived: number;
  bytesSent: number;
}

export async function listWebrtcSessions(c: MediamtxConfig): Promise<WebrtcSession[]> {
  const d = await call<{ items?: WebrtcSession[] }>(c, "GET", "/webrtcsessions/list");
  return d.items ?? [];
}

/** Cut someone off mid-stream. Used when a session ends or an admin intervenes. */
export async function kickWebrtcSession(c: MediamtxConfig, id: string): Promise<void> {
  await call(c, "POST", `/webrtcsessions/kick/${encodeURIComponent(id)}`);
}

/** Kick every WebRTC session attached to a path. */
export async function kickPath(c: MediamtxConfig, name: string): Promise<number> {
  const sessions = await listWebrtcSessions(c);
  const mine = sessions.filter((s) => s.path === name);
  let kicked = 0;
  for (const s of mine) {
    // One failure must not strand the rest — a half-kicked session is
    // worse than a slow one.
    await kickWebrtcSession(c, s.id)
      .then(() => { kicked += 1; })
      .catch(() => undefined);
  }
  return kicked;
}

export interface RecordingSegment {
  start: string;
}

export async function listRecordingSegments(
  c: MediamtxConfig,
  name: string,
): Promise<RecordingSegment[]> {
  try {
    const d = await call<{ segments?: RecordingSegment[] }>(
      c,
      "GET",
      `/recordings/get/${encodeURIComponent(name)}`,
    );
    return d.segments ?? [];
  } catch (err) {
    if (err instanceof MediamtxError && err.status === 404) return [];
    throw err;
  }
}

/**
 * Where a recorded segment can be watched.
 *
 * The playback server streams it; the file never comes near this app.
 * Reading it is authorised by the same hook as everything else, with
 * action "playback".
 */
export function playbackUrl(
  c: MediamtxConfig,
  name: string,
  start: string,
  durationSec: number,
): string {
  const q = new URLSearchParams({
    path: name,
    start,
    duration: String(Math.max(1, Math.round(durationSec))),
    format: "mp4",
  });
  return `${c.playbackUrl}/get?${q.toString()}`;
}

/* ── health ──────────────────────────────────────────────────── */

export interface HealthStep {
  step: "host" | "api" | "prefix";
  label: string;
  ok: boolean;
  detail: string | null;
}

export interface MediamtxHealth {
  ok: boolean;
  configured: boolean;
  enabled: boolean;
  steps: HealthStep[];
  pathCount: number | null;
  sessionCount: number | null;
  checkedAt: string;
}

/**
 * Is the streaming server actually there — and how far do we get?
 *
 * Three steps rather than one boolean, because the three failures
 * need three different fixes and "not reachable" sends someone
 * looking in the wrong place:
 *
 *   host   — DNS, firewall or TLS. Any HTTP answer at all counts,
 *            including a 404: we are asking whether something is
 *            listening, not whether it likes us.
 *   api    — the Control API is off, not proxied, or the password is
 *            wrong. This is the one that silently breaks recording
 *            while everything else looks fine.
 *   prefix — the configured path prefix has no matching entry in
 *            mediamtx.yml, so every broadcast would be refused by the
 *            media server with a message nobody sees.
 *
 * Never throws. A status page that 500s tells you less than one that
 * says "no".
 */
export async function checkHealth(): Promise<MediamtxHealth> {
  const c = await getMediamtxConfig();
  const steps: HealthStep[] = [];
  const base = {
    configured: !!c.publicUrl && !!c.apiUrl,
    enabled: c.enabled,
    checkedAt: new Date().toISOString(),
  };

  if (!c.publicUrl) {
    steps.push({ step: "host", label: "Public URL", ok: false, detail: "Not set yet." });
    return { ...base, ok: false, steps, pathCount: null, sessionCount: null };
  }

  // 1. Something is listening and TLS works.
  let hostOk = false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(c.publicUrl, {
      method: "GET",
      signal: ctrl.signal,
      cache: "no-store",
    }).finally(() => clearTimeout(timer));
    hostOk = true;
    steps.push({
      step: "host",
      label: "Host is reachable",
      ok: true,
      detail: `Answered ${res.status}.`,
    });
  } catch (err) {
    steps.push({
      step: "host",
      label: "Host is reachable",
      ok: false,
      detail:
        err instanceof Error && err.name === "AbortError"
          ? "No answer within 6 seconds."
          : "Couldn't connect — check DNS, the firewall and the certificate.",
    });
  }

  // 2. The Control API answers us specifically.
  let pathCount: number | null = null;
  let sessionCount: number | null = null;
  let apiOk = false;

  if (!c.apiUrl) {
    steps.push({ step: "api", label: "Control API", ok: false, detail: "Not set yet." });
  } else {
    try {
      const [paths, sessions] = await Promise.all([listPaths(c), listWebrtcSessions(c)]);
      apiOk = true;
      pathCount = paths.length;
      sessionCount = sessions.length;
      steps.push({
        step: "api",
        label: "Control API responds",
        ok: true,
        detail: `${paths.length} path${paths.length === 1 ? "" : "s"}, ${sessions.length} live connection${sessions.length === 1 ? "" : "s"}.`,
      });
    } catch (err) {
      const status = err instanceof MediamtxError ? err.status : undefined;
      steps.push({
        step: "api",
        label: "Control API responds",
        ok: false,
        detail:
          status === 401 || status === 403
            ? "Reachable, but the user or password was refused."
            : err instanceof Error
              ? err.message
              : "Unknown error.",
      });
    }
  }

  // 3. Does the prefix we're configured with exist over there?
  if (apiOk) {
    try {
      const configured = await call<{ items?: Array<{ name: string }> }>(
        c,
        "GET",
        "/config/paths/list",
      );
      const names = (configured.items ?? []).map((i) => i.name);
      // A regex entry starts with "~". The prefix has to appear in one
      // of them, or every broadcast path will match nothing.
      const wanted = c.pathPrefix || "";
      const covered =
        names.some((n) => n.startsWith("~") && n.includes(wanted)) ||
        names.includes("all_others") ||
        names.includes("all");
      steps.push({
        step: "prefix",
        label: "Path prefix is configured on the server",
        ok: covered,
        detail: covered
          ? `Matched by ${names.filter((n) => n.startsWith("~") || n.startsWith("all")).join(", ") || "a wildcard"}.`
          : `No entry in mediamtx.yml matches "${wanted}live-…". Broadcasts will be refused by the media server.`,
      });
    } catch {
      steps.push({
        step: "prefix",
        label: "Path prefix is configured on the server",
        ok: false,
        detail: "Couldn't read the server's path list.",
      });
    }
  }

  return {
    ...base,
    ok: hostOk && apiOk && steps.every((s) => s.ok),
    steps,
    pathCount,
    sessionCount,
  };
}
