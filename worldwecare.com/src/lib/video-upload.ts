/**
 * Receiving a video upload.
 *
 * The body is streamed straight to disk rather than buffered. A 2 GB
 * `await request.arrayBuffer()` is 2 GB of resident memory per upload,
 * which takes the server down long before it takes the upload.
 *
 * The client sends the raw file as the request body with an
 * `x-filename` header — not multipart. Multipart would mean either
 * buffering the whole thing or hand-rolling a streaming parser, and
 * the browser can report upload progress on a raw body just as well.
 */

import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import { prisma } from "./db";
import { getGroup } from "./settings";
import { normaliseLimits } from "./upload-limits";
import { VIDEO_TMP_DIR, convertAsset } from "./video";

/**
 * Container types a browser will hand us. The real gate is ffprobe
 * finding a video track — this only rejects the obviously wrong.
 */
const ALLOWED_PREFIX = "video/";
const EXTRA_ALLOWED = new Set([
  "application/octet-stream", // Safari sometimes sends this for .mov
  "application/mp4",
]);

export interface VideoUploadOutcome {
  ok: boolean;
  id?: string;
  error?: string;
  status?: number;
}

export async function receiveVideoUpload(
  request: Request,
  owner: { id: string; kind: "USER" | "ADMIN" },
  category: string,
): Promise<VideoUploadOutcome> {
  const mime = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!mime.startsWith(ALLOWED_PREFIX) && !EXTRA_ALLOWED.has(mime)) {
    return { ok: false, error: `Unsupported file type: ${mime || "unknown"}`, status: 415 };
  }

  const rawName = request.headers.get("x-filename") ?? "video";
  const originalName = decodeURIComponent(rawName).replace(/[\r\n]/g, "").slice(0, 300);

  const group = await getGroup("storage");
  const { maxVideoMB: maxMB } = normaliseLimits({
    maxVideoMB: group["storage.maxVideoMB"],
    maxVideoSeconds: group["storage.maxVideoSeconds"],
    maxFileMB: group["storage.maxFileMB"],
  });
  const hardCap = maxMB * 1024 * 1024;

  // A declared length that already exceeds the cap is worth refusing
  // before we spend the bandwidth.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > hardCap) {
    return { ok: false, error: `That video is larger than the ${maxMB} MB limit.`, status: 413 };
  }
  if (!request.body) {
    return { ok: false, error: "No file was sent.", status: 400 };
  }

  const asset = await prisma.videoAsset.create({
    data: {
      status: "UPLOADING",
      ownerId: owner.id,
      ownerKind: owner.kind,
      category: category.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "clips",
      originalName,
      originalMime: mime,
    },
    select: { id: true },
  });

  await fs.mkdir(VIDEO_TMP_DIR, { recursive: true });
  const target = path.join(VIDEO_TMP_DIR, `${asset.id}.src`);

  let bytes = 0;
  let tooBig = false;
  const sink = createWriteStream(target);

  try {
    const source = Readable.fromWeb(request.body as Parameters<typeof Readable.fromWeb>[0]);
    // Count in a Transform rather than a 'data' listener: attaching
    // 'data' flips the stream into flowing mode before pipeline has
    // wired up the destination, which can drop the first chunks of a
    // large upload. `content-length` is a claim, not a promise, so the
    // count has to be real.
    const meter = new Transform({
      transform(chunk: Buffer, _enc, done) {
        bytes += chunk.length;
        if (bytes > hardCap) {
          tooBig = true;
          done(new Error("TOO_BIG"));
          return;
        }
        done(null, chunk);
      },
    });
    await pipeline(source, meter, sink);
  } catch (err) {
    await fs.rm(target, { force: true }).catch(() => {});
    await prisma.videoAsset.delete({ where: { id: asset.id } }).catch(() => {});
    if (tooBig || (err instanceof Error && err.message === "TOO_BIG")) {
      return { ok: false, error: `That video is larger than the ${maxMB} MB limit.`, status: 413 };
    }
    return { ok: false, error: "The upload did not finish. Please try again.", status: 400 };
  }

  if (bytes === 0) {
    await fs.rm(target, { force: true }).catch(() => {});
    await prisma.videoAsset.delete({ where: { id: asset.id } }).catch(() => {});
    return { ok: false, error: "The uploaded file was empty.", status: 400 };
  }

  await prisma.videoAsset.update({
    where: { id: asset.id },
    data: { status: "QUEUED", originalSize: bytes, percent: 0, stage: "" },
  });

  // Fire and forget: the response should come back the moment the
  // bytes are on disk, and the browser then polls for conversion.
  void convertAsset(asset.id);

  return { ok: true, id: asset.id };
}
