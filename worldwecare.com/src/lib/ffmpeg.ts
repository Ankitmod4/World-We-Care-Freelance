/**
 * ffmpeg availability, readiness probing, and a no-root installer.
 *
 * Server-only — spawns processes and touches the filesystem. Never
 * import this from a client component.
 *
 * WHY A MANAGED INSTALL AT ALL
 * A Next.js server almost never runs as root, so a button that shells
 * out to `apt-get install ffmpeg` fails with EACCES on every real
 * deployment. What *does* work without privileges is unpacking a
 * statically linked build into a directory the app already owns. That
 * is what `installStaticFfmpeg` does: download, verify, extract into
 * `.ffmpeg/bin`, and remember the path.
 *
 * SECURITY POSTURE — read before changing
 *  • Only OWNER may trigger an install (enforced by the route).
 *  • Downloads may only come from `ALLOWED_HOSTS` over https. A custom
 *    URL is accepted, but it is checked against the same list, so this
 *    is not a general-purpose "fetch and run whatever" endpoint.
 *  • The SHA-256 of the archive is always computed and always
 *    reported. If an expected digest is supplied — by the admin in the
 *    form or by FFMPEG_SHA256 in the environment — a mismatch aborts
 *    before anything is extracted.
 *  • Both publishers ship rolling "latest" URLs, so we cannot pin a
 *    digest in source that stays correct. Transport authenticity comes
 *    from TLS to a pinned host; the optional digest is how an operator
 *    upgrades that to end-to-end verification. This is a real
 *    trade-off, not an oversight — say so in the UI.
 *  • Nothing extracted is trusted implicitly: only files literally
 *    named ffmpeg/ffprobe are copied out, and the install only counts
 *    as successful once the full probe (including a test encode)
 *    passes against the new binary.
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { getSetting, setSettings } from "./settings";

const run = promisify(execFile);

/* ── where things live ───────────────────────────────────────── */

const IS_WINDOWS = process.platform === "win32";
const EXE = IS_WINDOWS ? ".exe" : "";

/** Directory the managed install writes into. Override with FFMPEG_HOME. */
export function installRoot(): string {
  return process.env.FFMPEG_HOME?.trim() || path.join(process.cwd(), ".ffmpeg");
}

const managedPath = (name: string) => path.join(installRoot(), "bin", `${name}${EXE}`);

const SETTING_KEYS = {
  ffmpeg: "media.ffmpegPath",
  ffprobe: "media.ffprobePath",
  installedAt: "media.ffmpegInstalledAt",
  sha256: "media.ffmpegArchiveSha256",
  source: "media.ffmpegSource",
} as const;

/* ── check model ─────────────────────────────────────────────── */

export type CheckState = "pass" | "fail" | "warn";

export interface Check {
  id: string;
  label: string;
  state: CheckState;
  detail: string;
}

export interface FfmpegStatus {
  ready: boolean;
  ffmpegPath: string | null;
  ffprobePath: string | null;
  /** How the binary was found: env var, managed install, or PATH. */
  origin: "env" | "managed" | "path" | null;
  version: string | null;
  checks: Check[];
  platform: { os: NodeJS.Platform; arch: string; node: string };
  /** Whether this platform/arch has a one-click static build. */
  installable: boolean;
  /** Copy-and-paste command for installing it by hand. */
  manualCommand: string;
  managedRoot: string;
  installedAt: string | null;
  archiveSha256: string | null;
  source: string | null;
}

/* ── binary resolution ───────────────────────────────────────── */

async function isExecutableFile(p: string): Promise<boolean> {
  try {
    const st = await fs.stat(p);
    if (!st.isFile()) return false;
    if (!IS_WINDOWS) await fs.access(p, (await import("node:fs")).constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Ask the OS where a bare command resolves on PATH. */
async function whichOnPath(name: string): Promise<string | null> {
  try {
    const { stdout } = await run(IS_WINDOWS ? "where" : "which", [name], { timeout: 5_000 });
    const first = stdout.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
    return first || null;
  } catch {
    return null;
  }
}

/**
 * Resolve one binary. Explicit configuration wins over the managed
 * install, which wins over whatever happens to be on PATH — so an
 * operator who sets FFMPEG_PATH is never silently overridden.
 */
async function resolveBinary(
  name: "ffmpeg" | "ffprobe",
): Promise<{ path: string; origin: "env" | "managed" | "path" } | null> {
  const envKey = name === "ffmpeg" ? "FFMPEG_PATH" : "FFPROBE_PATH";
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv && (await isExecutableFile(fromEnv))) return { path: fromEnv, origin: "env" };

  const stored = await getSetting<string>(
    name === "ffmpeg" ? SETTING_KEYS.ffmpeg : SETTING_KEYS.ffprobe,
    "",
  );
  if (stored && (await isExecutableFile(stored))) return { path: stored, origin: "managed" };

  const managed = managedPath(name);
  if (await isExecutableFile(managed)) return { path: managed, origin: "managed" };

  const onPath = await whichOnPath(name);
  if (onPath && (await isExecutableFile(onPath))) return { path: onPath, origin: "path" };

  return null;
}

/**
 * The two binaries, resolved the same way the admin page reports them.
 * Callers that actually convert video use this rather than assuming
 * `ffmpeg` is on PATH — a managed install lives outside PATH entirely.
 */
export async function getFfmpegPaths(): Promise<{ ffmpeg: string | null; ffprobe: string | null }> {
  const [ffmpeg, ffprobe] = await Promise.all([resolveBinary("ffmpeg"), resolveBinary("ffprobe")]);
  return { ffmpeg: ffmpeg?.path ?? null, ffprobe: ffprobe?.path ?? null };
}

/* ── platform install descriptors ────────────────────────────── */

/**
 * Hosts a download may come from. TLS to one of these is the only
 * authenticity guarantee when no digest is configured, so this list is
 * the security boundary — do not widen it casually.
 */
const ALLOWED_HOSTS = new Set(["johnvansickle.com", "www.gyan.dev", "gyan.dev"]);

interface Descriptor {
  url: string;
  archive: "tar.xz" | "zip";
  publisher: string;
  checksumPage: string;
}

function descriptorFor(platform: NodeJS.Platform, arch: string): Descriptor | null {
  if (platform === "linux") {
    const slug = arch === "arm64" ? "arm64" : arch === "arm" ? "armhf" : arch === "ia32" ? "i686" : "amd64";
    return {
      url: `https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-${slug}-static.tar.xz`,
      archive: "tar.xz",
      publisher: "John Van Sickle static builds",
      checksumPage: "https://johnvansickle.com/ffmpeg/",
    };
  }
  if (platform === "win32" && (arch === "x64" || arch === "arm64")) {
    return {
      url: "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
      archive: "zip",
      publisher: "gyan.dev release builds",
      checksumPage: "https://www.gyan.dev/ffmpeg/builds/",
    };
  }
  // macOS has no comparable single-file static distribution, and the
  // team's Macs are dev machines where Homebrew is the honest answer.
  return null;
}

export function manualCommandFor(platform: NodeJS.Platform): string {
  if (platform === "darwin") return "brew install ffmpeg";
  if (platform === "win32") return "winget install --id Gyan.FFmpeg -e";
  return "sudo apt-get update && sudo apt-get install -y ffmpeg";
}

/* ── probing ─────────────────────────────────────────────────── */

function parseVersion(stdout: string): string | null {
  const m = /^ffmpeg version (\S+)/m.exec(stdout);
  return m ? m[1] : null;
}

async function encoderSupport(ffmpegPath: string): Promise<{ x264: boolean; aac: boolean }> {
  try {
    const { stdout } = await run(ffmpegPath, ["-hide_banner", "-encoders"], {
      timeout: 20_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    return { x264: /\slibx264\s/.test(stdout), aac: /\saac\s/.test(stdout) };
  } catch {
    return { x264: false, aac: false };
  }
}

/**
 * Encode one second of generated video and audio, then read the result
 * back with ffprobe.
 *
 * A binary that answers `-version` can still be unable to produce a
 * playable MP4 — a build without libx264, a broken temp directory, a
 * sandbox that blocks execve of a subprocess. Only an actual encode
 * proves the pipeline works, which is the whole question this page
 * exists to answer.
 */
async function testEncode(
  ffmpegPath: string,
  ffprobePath: string | null,
): Promise<{ ok: boolean; detail: string }> {
  let dir: string | null = null;
  try {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "ffcheck-"));
    const out = path.join(dir, "probe.mp4");
    const started = Date.now();
    await run(
      ffmpegPath,
      [
        "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", "testsrc=size=320x240:rate=15",
        "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100",
        "-t", "1",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast",
        "-c:a", "aac", "-shortest",
        "-movflags", "+faststart",
        out,
      ],
      { timeout: 60_000 },
    );
    const ms = Date.now() - started;

    const st = await fs.stat(out);
    if (st.size <= 0) return { ok: false, detail: "ffmpeg produced an empty file." };

    if (!ffprobePath) {
      return { ok: true, detail: `Encoded a 1s MP4 (${st.size} bytes) in ${ms} ms. ffprobe missing, so the result was not read back.` };
    }

    const { stdout } = await run(
      ffprobePath,
      ["-v", "error", "-show_entries", "stream=codec_name", "-of", "default=nw=1:nk=1", out],
      { timeout: 20_000 },
    );
    const codecs = stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!codecs.includes("h264")) {
      return { ok: false, detail: `Encoded, but the result has no H.264 stream (found: ${codecs.join(", ") || "nothing"}).` };
    }
    return { ok: true, detail: `Encoded and read back a 1s MP4 (${codecs.join(" + ")}, ${st.size} bytes) in ${ms} ms.` };
  } catch (err) {
    return { ok: false, detail: cleanError(err) };
  } finally {
    if (dir) await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function cleanError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { stderr?: string; message?: string };
    const text = (e.stderr || e.message || "").toString().trim();
    if (text) return text.split(/\r?\n/).slice(-3).join(" ").slice(0, 400);
  }
  return "Unknown error";
}

/** Full readiness report for the admin page. */
export async function probeFfmpeg(): Promise<FfmpegStatus> {
  const checks: Check[] = [];
  const platform = process.platform;
  const arch = process.arch;

  const ffmpeg = await resolveBinary("ffmpeg");
  const ffprobe = await resolveBinary("ffprobe");

  const [installedAt, archiveSha256, source] = (
    await Promise.all([
      getSetting<string>(SETTING_KEYS.installedAt, ""),
      getSetting<string>(SETTING_KEYS.sha256, ""),
      getSetting<string>(SETTING_KEYS.source, ""),
    ])
  ).map((v) => (v ? v : null)) as [string | null, string | null, string | null];

  const base = {
    ffmpegPath: ffmpeg?.path ?? null,
    ffprobePath: ffprobe?.path ?? null,
    origin: ffmpeg?.origin ?? null,
    platform: { os: platform, arch, node: process.version },
    installable: descriptorFor(platform, arch) !== null,
    manualCommand: manualCommandFor(platform),
    managedRoot: installRoot(),
    installedAt,
    archiveSha256,
    source,
  };

  // A typo'd FFMPEG_PATH silently falls through to PATH, which then
  // looks like "ffmpeg isn't installed" while the real problem is one
  // wrong character in an env var. Say so.
  const envPath = process.env.FFMPEG_PATH?.trim();
  if (envPath && ffmpeg?.origin !== "env") {
    checks.push({
      id: "env",
      label: "FFMPEG_PATH",
      state: "warn",
      detail: `Set to ${envPath}, but that is not an executable file — it is being ignored.`,
    });
  }

  if (!ffmpeg) {
    checks.push({
      id: "ffmpeg",
      label: "ffmpeg binary",
      state: "fail",
      detail: "Not found in FFMPEG_PATH, the managed install directory, or on PATH.",
    });
    return { ...base, ready: false, version: null, checks };
  }

  let version: string | null = null;
  try {
    const { stdout } = await run(ffmpeg.path, ["-hide_banner", "-version"], { timeout: 15_000 });
    version = parseVersion(stdout);
    checks.push({
      id: "ffmpeg",
      label: "ffmpeg binary",
      state: "pass",
      detail: `${version ? `Version ${version}` : "Runs"} · ${ffmpeg.path} (${originLabel(ffmpeg.origin)})`,
    });
  } catch (err) {
    checks.push({
      id: "ffmpeg",
      label: "ffmpeg binary",
      state: "fail",
      detail: `Found at ${ffmpeg.path} but it would not run: ${cleanError(err)}`,
    });
    return { ...base, ready: false, version: null, checks };
  }

  if (ffprobe) {
    let probeVersion: string | null = null;
    try {
      const { stdout } = await run(ffprobe.path, ["-hide_banner", "-version"], { timeout: 15_000 });
      probeVersion = /^ffprobe version (\S+)/m.exec(stdout)?.[1] ?? null;
    } catch {
      probeVersion = null;
    }
    checks.push({
      id: "ffprobe",
      label: "ffprobe binary",
      state: probeVersion ? "pass" : "fail",
      detail: probeVersion
        ? `Version ${probeVersion} · ${ffprobe.path}`
        : `Found at ${ffprobe.path} but it would not run.`,
    });
  } else {
    checks.push({
      id: "ffprobe",
      label: "ffprobe binary",
      state: "fail",
      detail: "Not found. Duration, dimensions and codec checks on uploads need it.",
    });
  }

  const enc = await encoderSupport(ffmpeg.path);
  checks.push({
    id: "libx264",
    label: "H.264 encoder (libx264)",
    state: enc.x264 ? "pass" : "fail",
    detail: enc.x264
      ? "Available — MP4 conversion can run."
      : "Missing. This build cannot produce H.264, so browser-playable MP4 is out of reach.",
  });
  checks.push({
    id: "aac",
    label: "AAC audio encoder",
    state: enc.aac ? "pass" : "warn",
    detail: enc.aac ? "Available." : "Missing. Converted video would be silent.",
  });

  const tmp = os.tmpdir();
  try {
    const probeFile = path.join(tmp, `ffcheck-${Date.now()}.tmp`);
    await fs.writeFile(probeFile, "ok");
    await fs.rm(probeFile, { force: true });
    checks.push({ id: "tmp", label: "Temp directory writable", state: "pass", detail: tmp });
  } catch (err) {
    checks.push({
      id: "tmp",
      label: "Temp directory writable",
      state: "fail",
      detail: `${tmp} — ${cleanError(err)}`,
    });
  }

  const encode = await testEncode(ffmpeg.path, ffprobe?.path ?? null);
  checks.push({
    id: "encode",
    label: "Test encode",
    state: encode.ok ? "pass" : "fail",
    detail: encode.detail,
  });

  const ready = checks.every((c) => c.state !== "fail");
  return { ...base, ready, version, checks };
}

function originLabel(origin: "env" | "managed" | "path"): string {
  if (origin === "env") return "from FFMPEG_PATH";
  if (origin === "managed") return "managed install";
  return "on PATH";
}

/* ── install ─────────────────────────────────────────────────── */

const MAX_ARCHIVE_BYTES = 250 * 1024 * 1024;
const HEX64 = /^[0-9a-f]{64}$/i;

export interface InstallResult {
  ok: boolean;
  message: string;
  sha256?: string;
  ffmpegPath?: string;
  ffprobePath?: string;
  version?: string | null;
}

/** One install at a time — two clicks must not race over the same dir. */
let installInFlight: Promise<InstallResult> | null = null;

export function isInstalling(): boolean {
  return installInFlight !== null;
}

export async function installStaticFfmpeg(opts: { url?: string; expectedSha256?: string } = {}) {
  if (installInFlight) return installInFlight;
  installInFlight = doInstall(opts).finally(() => {
    installInFlight = null;
  });
  return installInFlight;
}

async function doInstall(opts: { url?: string; expectedSha256?: string }): Promise<InstallResult> {
  const descriptor = descriptorFor(process.platform, process.arch);
  if (!descriptor && !opts.url) {
    return {
      ok: false,
      message: `No static build is published for ${process.platform}/${process.arch}. Install it with: ${manualCommandFor(process.platform)}`,
    };
  }

  const url = opts.url?.trim() || descriptor!.url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, message: "That is not a valid URL." };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, message: "Downloads must use https." };
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return {
      ok: false,
      message: `${parsed.hostname} is not an allowed download host. Allowed: ${[...ALLOWED_HOSTS].join(", ")}.`,
    };
  }

  const expected = (opts.expectedSha256 || process.env.FFMPEG_SHA256 || "").trim();
  if (expected && !HEX64.test(expected)) {
    return { ok: false, message: "The expected SHA-256 must be 64 hex characters." };
  }

  const archiveKind: "tar.xz" | "zip" =
    descriptor?.archive ?? (parsed.pathname.endsWith(".zip") ? "zip" : "tar.xz");

  let work: string | null = null;
  try {
    work = await fs.mkdtemp(path.join(os.tmpdir(), "ffinstall-"));
    const archivePath = path.join(work, archiveKind === "zip" ? "ffmpeg.zip" : "ffmpeg.tar.xz");

    // ── download, hashing as it streams ──
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": "WorldWeCare-admin/1.0 (ffmpeg installer)" },
      });
    } catch (err) {
      // Bare `fetch failed` tells an operator nothing. Nearly always
      // this is a server with no outbound HTTPS.
      return {
        ok: false,
        message: `Could not reach ${parsed.hostname}: ${cleanError(err)}. This server may have no outbound internet access — install ffmpeg from the command line instead.`,
      };
    }
    if (!res.ok || !res.body) {
      return { ok: false, message: `Download failed: HTTP ${res.status} ${res.statusText}` };
    }

    const hash = createHash("sha256");
    const handle = await fs.open(archivePath, "w");
    let bytes = 0;
    try {
      // @ts-expect-error — Node's fetch body is an async-iterable stream.
      for await (const chunk of res.body) {
        const buf = Buffer.from(chunk);
        bytes += buf.length;
        if (bytes > MAX_ARCHIVE_BYTES) {
          throw new Error(`Archive exceeded ${Math.round(MAX_ARCHIVE_BYTES / 1024 / 1024)} MB — refusing to continue.`);
        }
        hash.update(buf);
        await handle.write(buf);
      }
    } finally {
      await handle.close();
    }

    const sha256 = hash.digest("hex");
    if (expected && sha256.toLowerCase() !== expected.toLowerCase()) {
      return {
        ok: false,
        sha256,
        message: `Checksum mismatch — nothing was installed. Expected ${expected}, got ${sha256}.`,
      };
    }

    // ── extract ──
    const extractDir = path.join(work, "x");
    await fs.mkdir(extractDir, { recursive: true });
    try {
      if (archiveKind === "zip") {
        if (IS_WINDOWS) {
          await run(
            "powershell",
            ["-NoProfile", "-NonInteractive", "-Command",
             `Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${extractDir}' -Force`],
            { timeout: 300_000 },
          );
        } else {
          await run("unzip", ["-q", archivePath, "-d", extractDir], { timeout: 300_000 });
        }
      } else {
        await run("tar", ["-xJf", archivePath, "-C", extractDir], { timeout: 300_000 });
      }
    } catch (err) {
      return {
        ok: false,
        sha256,
        message: `Could not unpack the archive: ${cleanError(err)}. ${
          archiveKind === "zip" ? "Is unzip installed?" : "Is tar built with xz support?"
        }`,
      };
    }

    // ── pick out the two binaries, and nothing else ──
    const found = await findBinaries(extractDir);
    if (!found.ffmpeg) {
      return { ok: false, sha256, message: "The archive did not contain an ffmpeg binary." };
    }

    const binDir = path.join(installRoot(), "bin");
    await fs.mkdir(binDir, { recursive: true });
    const targetFfmpeg = path.join(binDir, `ffmpeg${EXE}`);
    const targetFfprobe = path.join(binDir, `ffprobe${EXE}`);

    await fs.copyFile(found.ffmpeg, targetFfmpeg);
    if (!IS_WINDOWS) await fs.chmod(targetFfmpeg, 0o755);
    if (found.ffprobe) {
      await fs.copyFile(found.ffprobe, targetFfprobe);
      if (!IS_WINDOWS) await fs.chmod(targetFfprobe, 0o755);
    }

    // ── prove it actually works before claiming success ──
    let version: string | null = null;
    try {
      const { stdout } = await run(targetFfmpeg, ["-hide_banner", "-version"], { timeout: 20_000 });
      version = parseVersion(stdout);
    } catch (err) {
      return { ok: false, sha256, message: `Installed, but the binary would not run: ${cleanError(err)}` };
    }
    const encode = await testEncode(targetFfmpeg, found.ffprobe ? targetFfprobe : null);
    if (!encode.ok) {
      return { ok: false, sha256, message: `Installed ${version ?? "ffmpeg"}, but the test encode failed: ${encode.detail}` };
    }

    // `setSettings` derives the group from the key prefix, so these all
    // land in the "media" group. An empty string means "not set" —
    // Prisma's InputJsonValue has no room for a real null here.
    await setSettings([
      { key: SETTING_KEYS.ffmpeg, value: targetFfmpeg },
      { key: SETTING_KEYS.ffprobe, value: found.ffprobe ? targetFfprobe : "" },
      { key: SETTING_KEYS.installedAt, value: new Date().toISOString() },
      { key: SETTING_KEYS.sha256, value: sha256 },
      { key: SETTING_KEYS.source, value: url },
    ]);

    return {
      ok: true,
      sha256,
      version,
      ffmpegPath: targetFfmpeg,
      ffprobePath: found.ffprobe ? targetFfprobe : undefined,
      message: `Installed ffmpeg ${version ?? ""} into ${binDir}.`.replace("  ", " "),
    };
  } catch (err) {
    return { ok: false, message: cleanError(err) };
  } finally {
    if (work) await fs.rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Walk the extracted tree for files named exactly ffmpeg/ffprobe.
 * Depth-limited, and it never follows symlinks out of the tree — an
 * archive is untrusted input even from an allowlisted host.
 */
async function findBinaries(
  root: string,
  depth = 0,
): Promise<{ ffmpeg: string | null; ffprobe: string | null }> {
  const result: { ffmpeg: string | null; ffprobe: string | null } = { ffmpeg: null, ffprobe: null };
  if (depth > 5) return result;

  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      const nested = await findBinaries(full, depth + 1);
      result.ffmpeg ??= nested.ffmpeg;
      result.ffprobe ??= nested.ffprobe;
    } else if (entry.isFile()) {
      if (entry.name === `ffmpeg${EXE}`) result.ffmpeg ??= full;
      else if (entry.name === `ffprobe${EXE}`) result.ffprobe ??= full;
    }
    if (result.ffmpeg && result.ffprobe) break;
  }
  return result;
}

/** Forget a managed install so detection falls back to PATH. */
export async function forgetManagedFfmpeg(): Promise<void> {
  await setSettings([
    { key: SETTING_KEYS.ffmpeg, value: "" },
    { key: SETTING_KEYS.ffprobe, value: "" },
    { key: SETTING_KEYS.installedAt, value: "" },
    { key: SETTING_KEYS.sha256, value: "" },
    { key: SETTING_KEYS.source, value: "" },
  ]);
}

/** Where an operator can compare the digest by hand. */
export function checksumPageFor(platform: NodeJS.Platform, arch: string): string | null {
  return descriptorFor(platform, arch)?.checksumPage ?? null;
}

export function publisherFor(platform: NodeJS.Platform, arch: string): string | null {
  return descriptorFor(platform, arch)?.publisher ?? null;
}

export function downloadUrlFor(platform: NodeJS.Platform, arch: string): string | null {
  return descriptorFor(platform, arch)?.url ?? null;
}
