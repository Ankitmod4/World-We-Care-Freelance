/**
 * The shape the uploader polls, shared by the member and admin routes.
 *
 * A row that says PROCESSING but stopped heartbeating is reported as
 * FAILED: the alternative is a progress bar that sits at 40% forever
 * because the server restarted mid-encode.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "./db";
import { VIDEO_DIR, VIDEO_TMP_DIR, isStale, nudge, stageMessage } from "./video";

export interface VideoStatusPayload {
  id: string;
  status: "UPLOADING" | "QUEUED" | "PROCESSING" | "READY" | "FAILED";
  percent: number;
  etaSeconds: number | null;
  stage: string;
  message: string;
  url: string | null;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  error: string | null;
}

export async function readVideoStatus(
  id: string,
  viewer: { id: string; isAdmin: boolean },
): Promise<VideoStatusPayload | null> {
  const asset = await prisma.videoAsset.findUnique({ where: { id } });
  if (!asset) return null;
  if (!viewer.isAdmin && asset.ownerId !== viewer.id) return null;

  // Restart anything the last deploy interrupted, and pick up work
  // that was queued behind the concurrency limit.
  await nudge(id);

  const stalled = isStale(asset.status, asset.heartbeatAt);
  const status = stalled ? "PROCESSING" : asset.status;

  return {
    id: asset.id,
    status: status as VideoStatusPayload["status"],
    percent: asset.status === "READY" ? 100 : asset.percent,
    etaSeconds: asset.etaSeconds,
    stage: asset.stage,
    message:
      asset.status === "READY"
        ? "Ready"
        : asset.status === "FAILED"
          ? "Something went wrong"
          : asset.status === "QUEUED"
            ? "Waiting for a slot…"
            : stageMessage(asset.stage),
    url: asset.url,
    posterUrl: asset.posterUrl,
    width: asset.width,
    height: asset.height,
    durationSec: asset.durationSec,
    error: asset.error,
  };
}

/** Remove an asset and everything it wrote to disk. */
export async function discardVideo(
  id: string,
  viewer: { id: string; isAdmin: boolean },
): Promise<boolean> {
  const asset = await prisma.videoAsset.findUnique({
    where: { id },
    select: { id: true, ownerId: true },
  });
  if (!asset) return false;
  if (!viewer.isAdmin && asset.ownerId !== viewer.id) return false;

  // Only ever the files this asset owns — the id is a cuid we
  // generated, never anything the client supplies as a path.
  const files = [
    path.join(VIDEO_DIR, `${id}.mp4`),
    path.join(VIDEO_DIR, `${id}.mp4.part`),
    path.join(VIDEO_DIR, `${id}.jpg`),
    path.join(VIDEO_DIR, `${id}.jpg.part`),
    path.join(VIDEO_TMP_DIR, `${id}.src`),
  ];
  await Promise.all(files.map((f) => fs.rm(f, { force: true }).catch(() => {})));
  await prisma.videoAsset.delete({ where: { id } }).catch(() => {});
  return true;
}
