/**
 * Live broadcasts. Anyone can go live.
 *
 * One person publishes from their browser over WHIP; everyone else
 * watches the same stream over HLS. That asymmetry is the whole
 * design: a publisher is one identified account holding a revocable
 * grant, and a viewer is an anonymous request for a file.
 *
 * FOUR RULES THAT ARE NOT OBVIOUS FROM THE TYPES:
 *
 *  1. THE SLUG IS AN ADDRESS, NOT A PASSWORD. It is in the URL bar,
 *     in browser history, and in every link anyone pastes. Publishing
 *     is authorised by a grant the app issues to the owner; the slug
 *     only says which stream you mean.
 *
 *  2. VIEWERS OF A PUBLIC STREAM CARRY NOTHING. There is no way to
 *     mint a token per anonymous viewer, so reading is authorised by
 *     the stream's own visibility and status. This is the one place
 *     the auth hook says yes without a token, and it is why
 *     UNLISTED still has to be unguessable.
 *
 *  3. LIMITS ARE COPIED AT CREATE TIME. `maxDurationMin` is snapshotted
 *     onto the row, so an admin tightening the cap never cuts off a
 *     broadcast already in progress.
 *
 *  4. ENDING ALWAYS FINISHES. Same as sessions: every remote call is
 *     best-effort and the database write is not. A stream the app
 *     believes is live is one whose grant still works.
 */

import { randomBytes } from "crypto";
import { prisma } from "./db";
import {
  disableRecording,
  enableRecording,
  getMediamtxConfig,
  hlsUrl,
  isConfigured,
  kickPath,
  whipUrl,
  type MediamtxConfig,
} from "./mediamtx";

/** A grant outlives the cap by this much, so an auto-end is ours to make. */
const GRANT_GRACE_MIN = 10;

/* ── addressing ──────────────────────────────────────────────── */

/**
 * The MediaMTX path for a broadcast.
 *
 * `live-` in the name, not just the prefix, so the auth hook can tell
 * a broadcast from a session path by shape alone before it touches
 * the database.
 */
export function pathForStream(c: MediamtxConfig, slug: string): string {
  return `${c.pathPrefix}live-${slug}`;
}

const SLUG_RE = /^[a-f0-9]{32}$/;

/** Pull the slug back out of a path, or null if it isn't a broadcast. */
export function parseStreamPath(c: MediamtxConfig, path: string): string | null {
  const prefix = `${c.pathPrefix}live-`;
  if (!path.startsWith(prefix)) return null;
  const slug = path.slice(prefix.length);
  return SLUG_RE.test(slug) ? slug : null;
}

function newSlug(): string {
  // 128 bits. Not a credential (rule 1), but an UNLISTED stream is
  // only as private as its address is hard to guess.
  return randomBytes(16).toString("hex");
}

/* ── shapes ──────────────────────────────────────────────────── */

export interface StreamCard {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: "IDLE" | "LIVE" | "ENDED";
  visibility: "PUBLIC" | "UNLISTED";
  ownerUserId: string | null;
  ownerName: string;
  ownerAvatar: string | null;
  startedAt: string | null;
  endedAt: string | null;
  viewerCount: number;
  viewerPeak: number;
  isMine: boolean;
  recording: boolean;
  /// Null only for broadcasts created before categories existed —
  /// createStream() has required one ever since.
  category: StreamCategory | null;
}

export interface StreamCategory {
  id: string;
  name: string;
  slug: string;
  emoji: string | null;
  color: string | null;
}

export interface BroadcastTicket {
  streamId: string;
  slug: string;
  token: string;
  expiresAt: string;
  publishUrl: string;
  /** So the owner can see what viewers see. */
  watchUrl: string;
  maxHeight: number;
  maxDurationMin: number;
  recording: boolean;
}

const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  status: true,
  visibility: true,
  ownerUserId: true,
  ownerNameSnapshot: true,
  ownerAvatarSnapshot: true,
  startedAt: true,
  endedAt: true,
  viewerCount: true,
  viewerPeak: true,
  recordingStartedAt: true,
  category: { select: { id: true, name: true, slug: true, emoji: true, color: true } },
} as const;

type CardRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: "IDLE" | "LIVE" | "ENDED";
  visibility: "PUBLIC" | "UNLISTED";
  ownerUserId: string | null;
  ownerNameSnapshot: string;
  ownerAvatarSnapshot: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  viewerCount: number;
  viewerPeak: number;
  recordingStartedAt: Date | null;
  category: StreamCategory | null;
};

function toCard(r: CardRow, viewerId?: string | null): StreamCard {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    status: r.status,
    visibility: r.visibility,
    ownerUserId: r.ownerUserId,
    ownerName: r.ownerNameSnapshot,
    ownerAvatar: r.ownerAvatarSnapshot,
    startedAt: r.startedAt?.toISOString() ?? null,
    endedAt: r.endedAt?.toISOString() ?? null,
    viewerCount: r.viewerCount,
    viewerPeak: r.viewerPeak,
    isMine: !!viewerId && r.ownerUserId === viewerId,
    recording: !!r.recordingStartedAt,
    category: r.category,
  };
}

/* ── reading ─────────────────────────────────────────────────── */

/** What's on right now. Public only — unlisted needs the link. */
export async function listLive(opts: {
  viewerId?: string | null;
  countryId?: string | null;
  categoryId?: string | null;
  take?: number;
} = {}): Promise<StreamCard[]> {
  const rows = await prisma.liveStream.findMany({
    where: {
      visibility: "PUBLIC",
      status: "LIVE",
      ...(opts.countryId ? { countryId: opts.countryId } : {}),
      ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    },
    orderBy: [{ viewerCount: "desc" }, { startedAt: "desc" }],
    take: Math.min(60, Math.max(1, opts.take ?? 30)),
    select: CARD_SELECT,
  });
  return rows.map((r) => toCard(r, opts.viewerId));
}

/** Everything one member owns, live or not. */
export async function listMine(userId: string): Promise<StreamCard[]> {
  const rows = await prisma.liveStream.findMany({
    where: { ownerUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: CARD_SELECT,
  });
  return rows.map((r) => toCard(r, userId));
}

/**
 * One stream by slug.
 *
 * Visibility is NOT checked here — an unlisted stream is meant to be
 * reachable by anyone holding the link, which is the whole point of
 * unlisted. What it does refuse is a stream nobody should see at all.
 */
export async function getBySlug(
  slug: string,
  viewerId?: string | null,
): Promise<StreamCard | null> {
  const r = await prisma.liveStream.findUnique({ where: { slug }, select: CARD_SELECT });
  return r ? toCard(r, viewerId) : null;
}

/* ── creating ────────────────────────────────────────────────── */

export interface CreateInput {
  userId: string;
  title: string;
  /// Required. Typed non-optional so a caller that forgets it fails to
  /// compile rather than silently creating an uncategorised stream.
  categoryId: string;
  summary?: string | null;
  visibility?: "PUBLIC" | "UNLISTED";
  countryId?: string | null;
}

/**
 * Why a member can't go live, in words they can act on — or null.
 *
 * Returned rather than thrown so the create page can grey the button
 * out and say why, instead of letting someone fill in a form and then
 * be told no.
 */
export async function whyNotAllowed(userId: string): Promise<string | null> {
  const c = await getMediamtxConfig();
  if (!isConfigured(c)) return "Live streaming isn't switched on yet.";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { canStream: true, isActive: true, bannedAt: true, emailVerifiedAt: true },
  });
  if (!user) return "We couldn't find your account.";
  if (!user.isActive || user.bannedAt) return "Your account can't go live.";
  if (!user.canStream) return "Going live has been turned off for your account.";
  if (c.requireEmailVerified && !user.emailVerifiedAt) {
    return "Verify your email address first — check your inbox for the link.";
  }

  // Only LIVE counts. A stream that was created and never started is
  // an abandoned setup, not a broadcast, and blocking someone because
  // of one is how a failed first attempt locks them out for six hours.
  let live = await prisma.liveStream.count({
    where: { ownerUserId: userId, status: "LIVE" },
  });

  if (live >= c.maxConcurrentPerUser) {
    // Before telling someone no, make sure the thing blocking them is
    // real. A broadcast whose publisher vanished still says LIVE here.
    await reconcileStuck(userId).catch(() => undefined);
    live = await prisma.liveStream.count({
      where: { ownerUserId: userId, status: "LIVE" },
    });
  }

  if (live >= c.maxConcurrentPerUser) {
    return c.maxConcurrentPerUser === 1
      ? "You're already broadcasting. End that stream first — you can do it from its card below."
      : `You can broadcast ${c.maxConcurrentPerUser} streams at once, and you're at the limit.`;
  }
  return null;
}

export async function createStream(input: CreateInput): Promise<StreamCard> {
  const blocked = await whyNotAllowed(input.userId);
  if (blocked) throw new Error(blocked);

  const title = input.title.trim();
  if (!title) throw new Error("Give your stream a title.");
  if (title.length > 200) throw new Error("Keep the title under 200 characters.");

  // Category is required, and checked against the table rather than
  // trusted from the client — a stale or retired id from a cached
  // picker would otherwise become a broadcast nobody can find by
  // browsing, or a foreign-key error the streamer can't act on.
  const categoryId = String(input.categoryId ?? "").trim();
  if (!categoryId) throw new Error("Choose a category so people can find your stream.");
  const category = await prisma.liveCategory.findFirst({
    where: { id: categoryId, isActive: true },
    select: { id: true },
  });
  if (!category) throw new Error("That category isn't available any more — pick another.");

  const c = await getMediamtxConfig();
  const owner = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, displayName: true, avatarUrl: true, countryId: true },
  });
  if (!owner) throw new Error("We couldn't find your account.");

  // Setting up a new stream abandons any previous setup that never
  // started. Otherwise every failed attempt leaves a ghost on the
  // member's list that they have no reason to understand.
  const abandoned = await prisma.liveStream.findMany({
    where: { ownerUserId: owner.id, status: "IDLE" },
    select: { id: true },
    take: 20,
  });
  for (const a of abandoned) {
    await endStream(a.id, "STALE", "Replaced by a newer stream.").catch(() => undefined);
  }

  const row = await prisma.liveStream.create({
    data: {
      slug: newSlug(),
      title,
      summary: input.summary?.trim()?.slice(0, 400) || null,
      visibility: input.visibility ?? c.defaultVisibility,
      ownerUserId: owner.id,
      ownerNameSnapshot: owner.displayName,
      ownerAvatarSnapshot: owner.avatarUrl,
      countryId: input.countryId ?? owner.countryId ?? null,
      categoryId: category.id,
      // Rule 3: the cap this stream lives under is decided now.
      maxDurationMin: c.maxDurationMin,
      recordingEnabled: c.autoRecord,
    },
    select: CARD_SELECT,
  });
  return toCard(row, input.userId);
}

/* ── going live ──────────────────────────────────────────────── */

/**
 * Mint the owner's publish ticket and mark the stream live.
 *
 * One grant per stream, replaced on every call rather than added to —
 * a refresh must not leave a working token behind.
 */
export async function startBroadcast(
  slug: string,
  userId: string,
): Promise<BroadcastTicket> {
  const c = await getMediamtxConfig();
  if (!isConfigured(c)) throw new Error("Live streaming isn't switched on yet.");

  const s = await prisma.liveStream.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      status: true,
      ownerUserId: true,
      maxDurationMin: true,
      recordingEnabled: true,
      recordingStartedAt: true,
    },
  });
  if (!s) throw new Error("That stream doesn't exist.");
  if (s.ownerUserId !== userId) throw new Error("This isn't your stream.");
  if (s.status === "ENDED") throw new Error("That stream has already ended.");

  const blocked = await whyNotAllowedToResume(userId, s.id);
  if (blocked) throw new Error(blocked);

  const expiresAt = new Date(Date.now() + (s.maxDurationMin + GRANT_GRACE_MIN) * 60_000);
  const token = randomBytes(32).toString("hex");

  await prisma.liveStreamGrant.upsert({
    where: { streamId_userId: { streamId: s.id, userId } },
    create: { token, streamId: s.id, userId, expiresAt },
    update: { token, expiresAt, revokedAt: null, useCount: 0, lastUsedAt: null },
  });

  // NOT set to LIVE here. Handing out a ticket is an intention to
  // broadcast, not a broadcast — and the browser's WHIP handshake can
  // still fail on CORS, a firewall, a codec or a withdrawn camera
  // permission. A stream marked LIVE on intent and then abandoned
  // sits on the Live page with a LIVE badge and a black player,
  // holding its owner's only slot. `confirmLive` below is what
  // actually flips it, and only after MediaMTX says a publisher
  // arrived.

  const path = pathForStream(c, s.slug);
  let recording = !!s.recordingStartedAt;
  if (s.recordingEnabled && !recording) {
    recording = await startRecording(s.id, path);
  }

  return {
    streamId: s.id,
    slug: s.slug,
    token,
    expiresAt: expiresAt.toISOString(),
    publishUrl: whipUrl(c, path),
    watchUrl: hlsUrl(c, path),
    maxHeight: c.maxHeight,
    maxDurationMin: s.maxDurationMin,
    recording,
  };
}

/**
 * The publisher says it connected. Check, then mark the stream live.
 *
 * Deliberately not "the browser told us so": the browser is the one
 * component that cannot be trusted about this, and it is also the one
 * most likely to be wrong — a WHIP POST can return 201 and then carry
 * no media. MediaMTX knows whether a path has a publisher, so that is
 * who is asked.
 *
 * Returns false rather than throwing when the publisher isn't there
 * yet; the caller retries for a few seconds, because MediaMTX takes a
 * moment to register a new source.
 */
export async function confirmLive(slug: string, userId: string): Promise<PublisherCheck> {
  const c = await getMediamtxConfig();
  const s = await prisma.liveStream.findUnique({
    where: { slug },
    select: { id: true, slug: true, status: true, ownerUserId: true, startedAt: true },
  });
  if (!s) throw new Error("That stream doesn't exist.");
  if (s.ownerUserId !== userId) throw new Error("This isn't your stream.");
  if (s.status === "ENDED") throw new Error("That stream has already ended.");
  if (!isConfigured(c)) return { live: false };

  const check = await inspectPublisher(c, s.slug);
  if (!check.live) return check;

  if (s.status !== "LIVE") {
    await prisma.liveStream.update({
      where: { id: s.id },
      data: { status: "LIVE", startedAt: s.startedAt ?? new Date() },
    });
  }
  return check;
}

/* ── what actually arrived ────────────────────────────────────────
 *
 * MediaMTX returns the codecs of every track on a path, and this used
 * to ignore them: it checked `ready` and `source` and marked the
 * stream LIVE. That is how a browser publishing VP8 — which MediaMTX
 * accepts and then cannot put into HLS — produced a LIVE badge over a
 * black player with working sound, for every viewer, with nothing
 * anywhere reporting a problem.
 *
 * A broadcast nobody can watch is not live.
 */

/** Video codecs MediaMTX can actually package into HLS. */
const HLS_VIDEO = /^(h264|h265|avc|hevc)$/;

const normalise = (track: string) => track.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Is this track a video track at all? */
const isVideo = (track: string) =>
  /^(h264|h265|avc|hevc|vp8|vp9|av1|mjpeg|m1v|m2v|mpeg[124]video)$/.test(normalise(track));

export interface PublisherCheck {
  live: boolean;
  /** Shown to the broadcaster when `live` is false. */
  problem?: string;
  tracks?: string[];
}

async function inspectPublisher(c: MediamtxConfig, slug: string): Promise<PublisherCheck> {
  const { getPath } = await import("./mediamtx");
  let p;
  try {
    p = await getPath(c, pathForStream(c, slug));
  } catch {
    // Unreachable is NOT "no publisher" — see reconcileStuck.
    throw new Error("unreachable");
  }

  if (!p?.ready || !p.source) return { live: false };

  const tracks = p.tracks ?? [];
  const video = tracks.filter(isVideo);

  if (video.length === 0) {
    return {
      live: false,
      tracks,
      problem:
        "The streaming server is receiving your audio but no video. " +
        "Check that the right camera is selected and that it isn't blocked or in use by another app.",
    };
  }

  const playable = video.some((t) => HLS_VIDEO.test(normalise(t)));
  if (!playable) {
    return {
      live: false,
      tracks,
      problem:
        `Your browser is sending ${video.join(", ")} video, which viewers can't play. ` +
        "Broadcasts have to be H.264. Chrome, Edge and Safari support it — if you're on Firefox " +
        "or a Linux build of Chromium, try one of those instead.",
    };
  }

  return { live: true, tracks };
}

/**
 * Does MediaMTX currently have a publisher on this stream's path?
 *
 * Deliberately does NOT look at codecs — `inspectPublisher` does that.
 * This one answers "is anyone still connected", which is what
 * `reconcileStuck` needs: a broadcast sending an unplayable codec is
 * broken, not abandoned, and ending it out from under its owner while
 * they are still talking would be the wrong repair.
 */
async function hasPublisher(c: MediamtxConfig, slug: string): Promise<boolean> {
  try {
    const { getPath } = await import("./mediamtx");
    const p = await getPath(c, pathForStream(c, slug));
    // `ready` means the path has a source and tracks. A path that
    // exists because a reader asked for it is not a broadcast.
    return !!p?.ready && !!p.source;
  } catch {
    // Unreachable is NOT "no publisher" — see reconcileStuck.
    throw new Error("unreachable");
  }
}

/**
 * End streams that say LIVE but have no publisher.
 *
 * The one rule that matters here: an unreachable MediaMTX must never
 * end anybody's broadcast. "I can't tell" and "nobody is streaming"
 * look identical from here, and acting on the first as if it were the
 * second would cut off a live broadcast every time the media server
 * hiccups.
 */
export async function reconcileStuck(userId?: string): Promise<number> {
  const c = await getMediamtxConfig();
  if (!isConfigured(c)) return 0;

  const open = await prisma.liveStream.findMany({
    where: { status: "LIVE", ...(userId ? { ownerUserId: userId } : {}) },
    select: { id: true, slug: true, startedAt: true },
    take: 100,
  });

  let ended = 0;
  for (const s of open) {
    // Give a just-started broadcast a moment to register before
    // deciding it isn't there.
    const age = Date.now() - (s.startedAt?.getTime() ?? 0);
    if (s.startedAt && age < 60_000) continue;

    let publishing: boolean;
    try {
      publishing = await hasPublisher(c, s.slug);
    } catch {
      continue; // can't tell — leave it alone
    }
    if (publishing) continue;

    await endStream(s.id, "STALE", "The broadcast stopped without being ended.")
      .then(() => { ended += 1; })
      .catch(() => undefined);
  }
  return ended;
}

/** The subset of the checks that still apply to a stream already created. */
async function whyNotAllowedToResume(userId: string, streamId: string): Promise<string | null> {
  const c = await getMediamtxConfig();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { canStream: true, isActive: true, bannedAt: true, emailVerifiedAt: true },
  });
  if (!user) return "We couldn't find your account.";
  if (!user.isActive || user.bannedAt) return "Your account can't go live.";
  if (!user.canStream) return "Going live has been turned off for your account.";
  if (c.requireEmailVerified && !user.emailVerifiedAt) {
    return "Verify your email address first — check your inbox for the link.";
  }
  void streamId; // concurrency is about NEW streams, not resuming this one
  return null;
}

/* ── recording ───────────────────────────────────────────────── */

/** All-or-nothing, same rule as sessions: never half-record. */
async function startRecording(streamId: string, path: string): Promise<boolean> {
  const c = await getMediamtxConfig();
  if (!isConfigured(c)) return false;
  try {
    await enableRecording(c, path, {
      deleteAfter: c.recordingRetentionDays > 0 ? `${c.recordingRetentionDays * 24}h` : "8760h",
    });
  } catch {
    await disableRecording(c, path).catch(() => undefined);
    return false;
  }
  await prisma.liveStream.update({
    where: { id: streamId },
    data: { recordingStartedAt: new Date(), recordingStoppedAt: null },
  });
  return true;
}

async function stopRecording(streamId: string, path: string): Promise<void> {
  const c = await getMediamtxConfig();
  if (isConfigured(c)) await disableRecording(c, path).catch(() => undefined);
  await prisma.liveStream
    .update({
      where: { id: streamId },
      data: { recordingStartedAt: null, recordingStoppedAt: new Date() },
    })
    .catch(() => undefined);
}

/** The owner turns recording on or off mid-broadcast. */
export async function setRecording(
  slug: string,
  userId: string,
  wanted: boolean,
): Promise<{ recording: boolean }> {
  const c = await getMediamtxConfig();
  const s = await prisma.liveStream.findUnique({
    where: { slug },
    select: { id: true, slug: true, ownerUserId: true, status: true },
  });
  if (!s) throw new Error("That stream doesn't exist.");
  if (s.ownerUserId !== userId) throw new Error("This isn't your stream.");
  if (s.status === "ENDED") throw new Error("That stream has already ended.");

  const path = pathForStream(c, s.slug);
  if (!wanted) {
    await stopRecording(s.id, path);
    await prisma.liveStream.update({ where: { id: s.id }, data: { recordingEnabled: false } });
    return { recording: false };
  }
  await prisma.liveStream.update({ where: { id: s.id }, data: { recordingEnabled: true } });
  return { recording: await startRecording(s.id, path) };
}

/* ── viewers ─────────────────────────────────────────────────── */

/**
 * How many people are watching, counted from the media server rather
 * than from anything the browser tells us.
 *
 * A browser-reported count is a number a viewer can invent. MediaMTX
 * knows how many readers a path actually has, so that is the number
 * shown. Failing to reach it leaves the last known count alone rather
 * than dropping the display to zero mid-broadcast.
 */
export async function refreshViewerCount(slug: string): Promise<number | null> {
  const c = await getMediamtxConfig();
  if (!isConfigured(c)) return null;

  const s = await prisma.liveStream.findUnique({
    where: { slug },
    select: { id: true, slug: true, status: true, viewerPeak: true },
  });
  if (!s || s.status !== "LIVE") return null;

  try {
    const { getPath } = await import("./mediamtx");
    const p = await getPath(c, pathForStream(c, s.slug));
    const count = p?.readers.length ?? 0;
    await prisma.liveStream.update({
      where: { id: s.id },
      data: {
        viewerCount: count,
        viewerPeak: Math.max(s.viewerPeak, count),
      },
    });
    return count;
  } catch {
    return null;
  }
}

/** One more person opened the watch page. Fire and forget. */
export async function noteView(slug: string): Promise<void> {
  await prisma.liveStream
    .update({ where: { slug }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);
}

/* ── ending ──────────────────────────────────────────────────── */

/** Rule 4: always finishes. */
export async function endStream(
  streamId: string,
  endedBy: "OWNER" | "ADMIN" | "LIMIT" | "STALE",
  reason?: string,
): Promise<void> {
  const s = await prisma.liveStream.findUnique({
    where: { id: streamId },
    select: { id: true, slug: true, status: true },
  });
  if (!s) throw new Error("That stream doesn't exist.");
  if (s.status === "ENDED") return; // idempotent

  const c = await getMediamtxConfig();
  if (isConfigured(c)) {
    const path = pathForStream(c, s.slug);
    await Promise.all([
      disableRecording(c, path).catch(() => undefined),
      kickPath(c, path).catch(() => undefined),
    ]);
  }

  // Revoke before marking: if the process dies between the two, the
  // key is already dead.
  await prisma.liveStreamGrant.updateMany({
    where: { streamId: s.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await prisma.liveStream.update({
    where: { id: s.id },
    data: {
      status: "ENDED",
      endedAt: new Date(),
      endedBy,
      endReason: reason?.slice(0, 2000) ?? null,
      viewerCount: 0,
      recordingStartedAt: null,
      recordingStoppedAt: new Date(),
    },
  });
}

export async function endBySlug(
  slug: string,
  userId: string,
): Promise<void> {
  const s = await prisma.liveStream.findUnique({
    where: { slug },
    select: { id: true, ownerUserId: true },
  });
  if (!s) throw new Error("That stream doesn't exist.");
  if (s.ownerUserId !== userId) throw new Error("This isn't your stream.");
  await endStream(s.id, "OWNER");
}

/**
 * End broadcasts that have run past their own cap, and idle ones
 * nobody ever started.
 *
 * The cap comes from the row, not from settings, so a stream ends at
 * the limit it was created under.
 */
export async function sweepStreams(): Promise<{ ended: number }> {
  const live = await prisma.liveStream.findMany({
    where: { status: "LIVE" },
    select: { id: true, startedAt: true, maxDurationMin: true },
    take: 200,
  });
  let ended = 0;
  for (const s of live) {
    if (!s.startedAt) continue;
    const over = Date.now() - s.startedAt.getTime() > s.maxDurationMin * 60_000;
    if (!over) continue;
    await endStream(s.id, "LIMIT", `Reached the ${s.maxDurationMin} minute limit.`)
      .then(() => { ended += 1; })
      .catch(() => undefined);
  }

  // Broadcasts whose publisher went away without ending the stream.
  ended += await reconcileStuck().catch(() => 0);

  // Created, never started, and long abandoned.
  const stale = await prisma.liveStream.findMany({
    where: { status: "IDLE", createdAt: { lt: new Date(Date.now() - 6 * 3600_000) } },
    select: { id: true },
    take: 200,
  });
  for (const s of stale) {
    await endStream(s.id, "STALE").then(() => { ended += 1; }).catch(() => undefined);
  }
  return { ended };
}

/* ── the auth hook's question, for broadcasts ────────────────── */

export interface StreamAuthResult {
  allow: boolean;
  reason: string;
  streamId?: string;
}

/**
 * May this request publish or read this broadcast path?
 *
 * The asymmetry in rule 2 lives here, and it is the one place in the
 * app that says yes without a token:
 *
 *   publish — owner only, with a live grant. Same rules as everything
 *             else.
 *   read    — a PUBLIC or UNLISTED stream that is LIVE is readable by
 *             anyone. There is no token to check because there is no
 *             way to issue one to an anonymous viewer.
 *
 * An ENDED stream is readable by nobody, which is what stops a
 * recording being served to the world through the live path.
 */
export async function authoriseStream(ask: {
  slug: string;
  action: string;
  token: string;
}): Promise<StreamAuthResult> {
  const s = await prisma.liveStream.findUnique({
    where: { slug: ask.slug },
    select: { id: true, status: true, visibility: true, ownerUserId: true },
  });
  if (!s) return { allow: false, reason: "stream:unknown" };
  if (s.status === "ENDED") return { allow: false, reason: "stream:ended" };

  if (ask.action === "read") {
    // Rule 2. Unlisted is included on purpose: its privacy comes from
    // an unguessable address, not from a check here, and a viewer who
    // was given the link has nothing to present.
    if (s.status !== "LIVE") return { allow: false, reason: "stream:notLive" };
    return { allow: true, reason: "read:public", streamId: s.id };
  }

  if (ask.action !== "publish") return { allow: false, reason: `action:${ask.action}` };

  if (!ask.token || ask.token.length !== 64) return { allow: false, reason: "token:shape" };
  const grant = await prisma.liveStreamGrant.findUnique({
    where: { token: ask.token },
    select: { streamId: true, userId: true, expiresAt: true, revokedAt: true },
  });
  if (!grant) return { allow: false, reason: "token:unknown" };
  if (grant.revokedAt) return { allow: false, reason: "token:revoked" };
  if (grant.expiresAt.getTime() <= Date.now()) return { allow: false, reason: "token:expired" };
  // A grant for one stream must not publish to another.
  if (grant.streamId !== s.id) return { allow: false, reason: "token:otherStream" };
  if (grant.userId !== s.ownerUserId) return { allow: false, reason: "token:notOwner" };

  return { allow: true, reason: "ok", streamId: s.id };
}

export async function noteStreamGrantUse(token: string, ip: string | null): Promise<void> {
  await prisma.liveStreamGrant
    .update({
      where: { token },
      data: { lastUsedAt: new Date(), useCount: { increment: 1 }, lastIp: ip ?? undefined },
    })
    .catch(() => undefined);
}

/* ── admin ───────────────────────────────────────────────────── */

export interface AdminStreamRow extends StreamCard {
  countryId: string | null;
  createdAt: string;
  endedBy: string | null;
  endReason: string | null;
  viewCount: number;
  path: string;
  ownerCanStream: boolean;
}

export async function listAdminStreams(opts: {
  status?: "IDLE" | "LIVE" | "ENDED";
  q?: string;
  take?: number;
} = {}): Promise<AdminStreamRow[]> {
  const c = await getMediamtxConfig();
  const q = opts.q?.trim();
  const rows = await prisma.liveStream.findMany({
    where: {
      ...(opts.status ? { status: opts.status } : {}),
      ...(q
        ? { OR: [{ title: { contains: q } }, { ownerNameSnapshot: { contains: q } }] }
        : {}),
    },
    // Live first, then most recent: a moderator opens this page to see
    // what is on air, not what happened last week.
    orderBy: [{ status: "asc" }, { startedAt: "desc" }, { createdAt: "desc" }],
    take: Math.min(200, Math.max(1, opts.take ?? 50)),
    select: { ...CARD_SELECT, countryId: true, createdAt: true, endedBy: true, endReason: true, viewCount: true },
  });

  // One query for the owners' streaming flag rather than one per row.
  const ownerIds = [...new Set(rows.map((r) => r.ownerUserId).filter((v): v is string => !!v))];
  const owners = ownerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, canStream: true },
      })
    : [];
  const canStreamById = new Map<string, boolean>();
  for (const o of owners) canStreamById.set(o.id, o.canStream);

  return rows.map((r) => ({
    ...toCard(r),
    countryId: r.countryId,
    createdAt: r.createdAt.toISOString(),
    endedBy: r.endedBy,
    endReason: r.endReason,
    viewCount: r.viewCount,
    path: pathForStream(c, r.slug),
    ownerCanStream: r.ownerUserId ? (canStreamById.get(r.ownerUserId) ?? true) : true,
  }));
}

/**
 * Stop one member going live, or let them again.
 *
 * Turning it off ends whatever they have running: a block that leaves
 * the current broadcast on air is not a block.
 */
export async function setCanStream(
  userId: string,
  allowed: boolean,
): Promise<{ ended: number }> {
  await prisma.user.update({ where: { id: userId }, data: { canStream: allowed } });
  if (allowed) return { ended: 0 };

  const running = await prisma.liveStream.findMany({
    where: { ownerUserId: userId, status: { in: ["IDLE", "LIVE"] } },
    select: { id: true },
  });
  let ended = 0;
  for (const s of running) {
    await endStream(s.id, "ADMIN", "The owner's streaming access was withdrawn.")
      .then(() => { ended += 1; })
      .catch(() => undefined);
  }
  return { ended };
}
