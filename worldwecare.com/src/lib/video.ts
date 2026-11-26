/**
 * Video conversion pipeline.
 *
 * Server-only. Every uploaded video is converted to H.264 / AAC in an
 * MP4 with a poster frame before any URL for it exists. Phones record
 * HEVC in .mov, desktops hand us .mkv and .webm, and none of that plays
 * everywhere — iOS Safari least of all.
 *
 * ────────────────────────────────────────────────────────────────
 * HARD-WON RULES. Each of these cost a real debugging session on the
 * sister project; please do not "simplify" them away.
 *
 * 1. EVEN DIMENSIONS. libx264 with yuv420p refuses odd width or
 *    height. Production hit a 1918x1071 clip and ffmpeg aborted with
 *    exit 187. The scale filter below rounds both axes down to even.
 *
 * 2. NEVER FORCE -level. Forcing `-level 4.0` on 1080p60 makes the
 *    macroblock rate exceed the level limit; the file encodes, then
 *    hardware decoders reject it with MEDIA_ERR_DECODE. Let x264
 *    choose the level.
 *
 * 3. NEVER FALL BACK TO THE ORIGINAL. The original corruption bug was
 *    a catch block that stored the source .mov when conversion failed,
 *    producing a URL that no browser could play. A failed conversion
 *    is a FAILED row and no URL — loud, not silent.
 *
 * 4. PUBLISH ATOMICALLY. Encode to `.part`, verify with ffprobe, then
 *    rename. A reader must never be handed a half-written file.
 *
 * 5. ONE CONVERSION PER ASSET. A status poll must not be able to start
 *    a second ffmpeg over the same output path — that produced files
 *    with "Invalid NAL unit size" and pix_fmt=unknown.
 * ────────────────────────────────────────────────────────────────
 */

import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { prisma } from "./db";
import { getFfmpegPaths } from "./ffmpeg";
import { getGroup, getSetting } from "./settings";
import { normaliseLimits } from "./upload-limits";

const run = promisify(execFile);

const PUBLIC_ROOT = path.join(process.cwd(), "public");
export const VIDEO_DIR = path.join(PUBLIC_ROOT, "uploads", "videos");
export const VIDEO_TMP_DIR = path.join(VIDEO_DIR, "tmp");

/** Longest edge of the output. 4K phone footage is not worth serving. */
const MAX_EDGE = 1920;

/**
 * Rounds both axes down to even AND caps the longer edge, in one
 * filter. Verified against 1919x1071 (→1918x1070), 1080x2400
 * (→864x1920), 3840x2160 (→1920x1080) and 101x57 (→100x56).
 */
const SCALE_FILTER =
  `scale=w='if(gte(iw,ih),trunc(min(${MAX_EDGE},iw)/2)*2,-2)'` +
  `:h='if(gte(iw,ih),-2,trunc(min(${MAX_EDGE},ih)/2)*2)'`;

/** Only this many conversions run at once — a small VPS has limits. */
const MAX_CONCURRENT = 2;

/** Assets currently being converted in this process. */
const inFlight = new Set<string>();

export function activeConversions(): number {
  return inFlight.size;
}

/* ── probing ─────────────────────────────────────────────────── */

export interface ProbeResult {
  durationSec: number;
  width: number;
  height: number;
  videoCodec: string | null;
  audioCodec: string | null;
  pixFmt: string | null;
  container: string;
  hasVideo: boolean;
}

export async function ffprobeFile(ffprobe: string, file: string): Promise<ProbeResult | null> {
  try {
    const { stdout } = await run(
      ffprobe,
      ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file],
      { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 },
    );
    const data = JSON.parse(stdout) as {
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        width?: number;
        height?: number;
        pix_fmt?: string;
        duration?: string;
      }>;
      format?: { duration?: string; format_name?: string };
    };
    const streams = data.streams ?? [];
    const v = streams.find((s) => s.codec_type === "video");
    const a = streams.find((s) => s.codec_type === "audio");
    const duration = Number(data.format?.duration ?? v?.duration ?? 0);

    return {
      durationSec: Number.isFinite(duration) && duration > 0 ? duration : 0,
      width: v?.width ?? 0,
      height: v?.height ?? 0,
      videoCodec: v?.codec_name ?? null,
      audioCodec: a?.codec_name ?? null,
      pixFmt: v?.pix_fmt ?? null,
      container: data.format?.format_name ?? "",
      hasVideo: !!v,
    };
  } catch {
    return null;
  }
}

/* ── the conversion ──────────────────────────────────────────── */

interface Stage {
  key: string;
  /** Weight of this stage in the overall percentage. */
  share: number;
  message: string;
}

/**
 * The messages the uploader shows while it works. Deliberately plain
 * language — "Transcoding stream 0:1" tells a member nothing.
 */
export const STAGES: Stage[] = [
  { key: "inspect", share: 5, message: "Checking the video…" },
  { key: "convert", share: 80, message: "Converting so it plays on every device…" },
  { key: "poster", share: 8, message: "Picking a thumbnail…" },
  { key: "verify", share: 5, message: "Making sure it plays…" },
  { key: "finish", share: 2, message: "Almost done…" },
];

function stageFloor(key: string): number {
  let floor = 0;
  for (const s of STAGES) {
    if (s.key === key) return floor;
    floor += s.share;
  }
  return floor;
}

function stageShare(key: string): number {
  return STAGES.find((s) => s.key === key)?.share ?? 0;
}

async function setProgress(
  id: string,
  stageKey: string,
  within: number,
  etaSeconds: number | null,
): Promise<void> {
  const percent = Math.max(
    0,
    Math.min(99, Math.round(stageFloor(stageKey) + stageShare(stageKey) * Math.max(0, Math.min(1, within)))),
  );
  await prisma.videoAsset
    .update({
      where: { id },
      data: {
        percent,
        stage: stageKey,
        etaSeconds: etaSeconds !== null ? Math.max(0, Math.round(etaSeconds)) : null,
        heartbeatAt: new Date(),
      },
    })
    .catch(() => {});
}

async function fail(id: string, message: string): Promise<void> {
  await prisma.videoAsset
    .update({
      where: { id },
      data: { status: "FAILED", error: message.slice(0, 2000), etaSeconds: null, heartbeatAt: new Date() },
    })
    .catch(() => {});
}

/**
 * Run ffmpeg, reporting progress from `-progress pipe:1`.
 *
 * Resolves with the exit code; rejects only if the process could not
 * be spawned at all.
 */
function runFfmpegWithProgress(
  ffmpeg: string,
  args: string[],
  durationSec: number,
  onProgress: (fraction: number, etaSeconds: number | null) => void,
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { stdio: ["ignore", "pipe", "pipe"] });
    const started = Date.now();
    let stderr = "";
    let buffer = "";

    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const [key, value] = line.split("=");
        if (key !== "out_time_us" && key !== "out_time_ms") continue;
        const micro = key === "out_time_us" ? Number(value) : Number(value) * 1000;
        if (!Number.isFinite(micro) || durationSec <= 0) continue;
        const fraction = Math.max(0, Math.min(1, micro / 1_000_000 / durationSec));
        const elapsed = (Date.now() - started) / 1000;
        // Only trust an ETA once there's enough signal for the rate to
        // mean something; before that a 3-second sample says "4 hours".
        const eta = fraction > 0.03 && elapsed > 2 ? (elapsed / fraction) * (1 - fraction) : null;
        onProgress(fraction, eta);
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 20_000) stderr = stderr.slice(-20_000);
    });

    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stderr }));
  });
}

/** Last few meaningful lines of ffmpeg's stderr, for the error field. */
function tailError(stderr: string): string {
  const lines = stderr
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^\s*(frame|size|video:|Press \[q\])/.test(l));
  return lines.slice(-4).join(" · ").slice(0, 600) || "ffmpeg failed with no output";
}

/**
 * Can we simply repackage rather than re-encode?
 *
 * A clip that is already H.264 in yuv420p with AAC audio and even
 * dimensions is playable everywhere as-is; all it needs is an MP4
 * container with the moov atom at the front. That turns a two-minute
 * transcode into a two-second copy, losslessly.
 */
export function canRemux(probe: ProbeResult): boolean {
  return (
    probe.videoCodec === "h264" &&
    (probe.pixFmt === "yuv420p" || probe.pixFmt === "yuvj420p") &&
    (probe.audioCodec === null || probe.audioCodec === "aac") &&
    probe.width > 0 &&
    probe.height > 0 &&
    probe.width % 2 === 0 &&
    probe.height % 2 === 0 &&
    probe.width <= MAX_EDGE &&
    probe.height <= MAX_EDGE
  );
}

/**
 * The exact ffmpeg invocation, as a pure function so it can be tested
 * against real files without a database. Every rule in the header
 * comment is encoded here.
 */
export function buildConvertArgs(probe: ProbeResult, source: string, output: string): string[] {
  if (canRemux(probe)) {
    return [
      "-hide_banner", "-nostdin", "-loglevel", "error", "-y",
      "-i", source,
      "-c", "copy",
      "-movflags", "+faststart",
      "-progress", "pipe:1", "-nostats",
      "-f", "mp4",
      output,
    ];
  }
  return [
    "-hide_banner", "-nostdin", "-loglevel", "error", "-y",
    "-i", source,
    // RULE 1 — even dimensions, and cap the long edge.
    "-vf", SCALE_FILTER,
    "-c:v", "libx264",
    "-profile:v", "high",
    // RULE 2 — no -level. x264 picks one the file actually needs.
    "-pix_fmt", "yuv420p",
    "-preset", "veryfast",
    "-crf", "23",
    ...(probe.audioCodec ? ["-c:a", "aac", "-b:a", "128k", "-ac", "2"] : ["-an"]),
    "-movflags", "+faststart",
    "-progress", "pipe:1", "-nostats",
    "-f", "mp4",
    output,
  ];
}

/**
 * Convert one asset. Safe to call more than once — the second caller
 * returns immediately.
 */
export async function convertAsset(id: string): Promise<void> {
  if (inFlight.has(id)) return;
  if (inFlight.size >= MAX_CONCURRENT) return; // picked up by the next poll

  // Compare-and-set: only the caller that flips QUEUED → PROCESSING
  // gets to run, so two requests racing cannot both start ffmpeg.
  const claimed = await prisma.videoAsset.updateMany({
    where: { id, status: "QUEUED" },
    data: { status: "PROCESSING", percent: 0, stage: "inspect", heartbeatAt: new Date(), error: null },
  });
  if (claimed.count === 0) return;

  inFlight.add(id);
  try {
    await doConvert(id);
  } catch (err) {
    await fail(id, err instanceof Error ? err.message : "Conversion failed");
  } finally {
    inFlight.delete(id);
  }
}

async function doConvert(id: string): Promise<void> {
  const asset = await prisma.videoAsset.findUnique({ where: { id } });
  if (!asset) return;

  const { ffmpeg, ffprobe } = await getFfmpegPaths();
  if (!ffmpeg || !ffprobe) {
    await fail(
      id,
      "ffmpeg is not installed on this server. An administrator can set it up in Settings → Media / ffmpeg.",
    );
    return;
  }

  const source = path.join(VIDEO_TMP_DIR, `${id}.src`);
  const finalMp4 = path.join(VIDEO_DIR, `${id}.mp4`);
  const finalPoster = path.join(VIDEO_DIR, `${id}.jpg`);
  const partMp4 = `${finalMp4}.part`;
  const partPoster = `${finalPoster}.part`;

  const cleanup = async () => {
    await Promise.all([
      fs.rm(partMp4, { force: true }).catch(() => {}),
      fs.rm(partPoster, { force: true }).catch(() => {}),
    ]);
  };

  try {
    await fs.access(source);
  } catch {
    await fail(id, "The uploaded file is missing — please upload it again.");
    return;
  }

  // ── inspect ──
  await setProgress(id, "inspect", 0.2, null);
  const probe = await ffprobeFile(ffprobe, source);
  if (!probe || !probe.hasVideo) {
    await fs.rm(source, { force: true }).catch(() => {});
    await fail(id, "That file does not contain a video track.");
    return;
  }
  const storage = await getGroup("storage");
  const { maxVideoSeconds: maxSeconds } = normaliseLimits({
    maxVideoMB: storage["storage.maxVideoMB"],
    maxVideoSeconds: storage["storage.maxVideoSeconds"],
    maxFileMB: storage["storage.maxFileMB"],
  });
  if (maxSeconds > 0 && probe.durationSec > maxSeconds) {
    await fs.rm(source, { force: true }).catch(() => {});
    await fail(id, `That video is ${Math.round(probe.durationSec)}s long — the limit is ${maxSeconds}s.`);
    return;
  }
  await setProgress(id, "inspect", 1, null);

  // ── convert (or remux) ──
  await fs.mkdir(VIDEO_DIR, { recursive: true });
  const args = buildConvertArgs(probe, source, partMp4);

  let lastWrite = 0;
  const result = await runFfmpegWithProgress(ffmpeg, args, probe.durationSec, (fraction, eta) => {
    const now = Date.now();
    // Throttle: a 30-minute video emits progress several times a
    // second, and every one of those would be a DB write.
    if (now - lastWrite < 1200) return;
    lastWrite = now;
    void setProgress(id, "convert", fraction, eta);
  });

  if (result.code !== 0) {
    await cleanup();
    await fs.rm(source, { force: true }).catch(() => {});
    // RULE 3 — no fallback to the original.
    await fail(id, `Could not convert this video. ${tailError(result.stderr)}`);
    return;
  }

  // ── poster ──
  await setProgress(id, "poster", 0.2, null);
  // A frame 10% in is nearly always more representative than frame 0,
  // which on phone footage is often a blur or a black frame.
  const posterAt = probe.durationSec > 3 ? Math.min(probe.durationSec * 0.1, 10) : 0;
  const posterOk = await extractPoster(ffmpeg, partMp4, partPoster, posterAt);
  if (!posterOk && posterAt > 0) await extractPoster(ffmpeg, partMp4, partPoster, 0);

  // ── verify ──
  await setProgress(id, "verify", 0.3, null);
  const out = await ffprobeFile(ffprobe, partMp4);
  if (!out || out.videoCodec !== "h264" || out.durationSec <= 0) {
    await cleanup();
    await fs.rm(source, { force: true }).catch(() => {});
    await fail(
      id,
      out
        ? `The converted file was not usable (codec ${out.videoCodec ?? "unknown"}, ${out.durationSec}s).`
        : "The converted file could not be read back.",
    );
    return;
  }
  const stat = await fs.stat(partMp4);
  if (stat.size <= 0) {
    await cleanup();
    await fail(id, "The converted file was empty.");
    return;
  }

  // ── publish atomically ──  RULE 4
  await setProgress(id, "finish", 0.5, null);
  await fs.rename(partMp4, finalMp4);
  let hasPoster = false;
  try {
    await fs.access(partPoster);
    await fs.rename(partPoster, finalPoster);
    hasPoster = true;
  } catch {
    hasPoster = false;
  }
  await fs.rm(source, { force: true }).catch(() => {});

  const cdnBase = await getSetting<string>("storage.publicBaseUrl", "");
  const prefix = cdnBase ? cdnBase.replace(/\/$/, "") : "";

  await prisma.videoAsset.update({
    where: { id },
    data: {
      status: "READY",
      url: `${prefix}/uploads/videos/${id}.mp4`,
      posterUrl: hasPoster ? `${prefix}/uploads/videos/${id}.jpg` : null,
      width: out.width,
      height: out.height,
      durationSec: out.durationSec,
      outputSize: stat.size,
      percent: 100,
      stage: "done",
      etaSeconds: 0,
      heartbeatAt: new Date(),
      error: null,
    },
  });
}

/**
 * Exported so it can be tested against the REAL output path. The
 * original bug survived a test suite because the harness wrote to a
 * clean `.jpg` while production wrote to `.jpg.part` — the extension
 * was the whole bug.
 */
export async function extractPoster(
  ffmpeg: string,
  input: string,
  output: string,
  atSeconds: number,
): Promise<boolean> {
  try {
    await run(
      ffmpeg,
      [
        "-hide_banner", "-nostdin", "-loglevel", "error", "-y",
        // Input-seek is fast and accurate enough on a file we just
        // wrote with faststart.
        "-ss", atSeconds.toFixed(3),
        "-i", input,
        "-frames:v", "1",
        "-vf", `scale=w='min(1280,iw)':h=-2`,
        "-q:v", "3",
        // MUST be explicit. The output path ends in `.part`, and
        // ffmpeg infers the muxer from the extension — without this it
        // fails with "Unable to find a suitable output format", the
        // catch below swallows it, and every uploaded clip silently
        // ends up with no thumbnail. The video itself already passes
        // `-f mp4` for the same reason.
        "-f", "image2",
        "-c:v", "mjpeg",
        output,
      ],
      { timeout: 60_000 },
    );
    const st = await fs.stat(output);
    return st.size > 0;
  } catch (err) {
    // A missing poster is not fatal — the player falls back to its
    // first frame — but it should not be invisible either.
    console.warn(
      `[video] poster extraction failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

/* ── recovery ────────────────────────────────────────────────── */

/** Rows stuck in PROCESSING with no heartbeat — the server restarted. */
const STALE_MS = 90_000;

export function isStale(status: string, heartbeatAt: Date | null): boolean {
  if (status !== "PROCESSING") return false;
  if (!heartbeatAt) return true;
  return Date.now() - heartbeatAt.getTime() > STALE_MS;
}

/**
 * Called from the status endpoint. Restarts work that was interrupted,
 * and picks up assets that were queued while the worker was busy.
 */
export async function nudge(id: string): Promise<void> {
  const asset = await prisma.videoAsset.findUnique({
    where: { id },
    select: { status: true, heartbeatAt: true },
  });
  if (!asset) return;

  if (asset.status === "QUEUED") {
    void convertAsset(id);
    return;
  }
  if (isStale(asset.status, asset.heartbeatAt) && !inFlight.has(id)) {
    // Put it back in the queue so the compare-and-set in convertAsset
    // is still the only thing that can start ffmpeg.
    await prisma.videoAsset.updateMany({
      where: { id, status: "PROCESSING" },
      data: { status: "QUEUED", percent: 0, stage: "" },
    });
    void convertAsset(id);
  }
}

/** Human-readable message for the current stage. */
export function stageMessage(stage: string): string {
  return STAGES.find((s) => s.key === stage)?.message ?? "Processing video…";
}
