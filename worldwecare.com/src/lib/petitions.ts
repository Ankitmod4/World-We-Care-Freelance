/**
 * Petitions.
 *
 * "Users can start or sign petitions against corruption or in support
 * of a good cause. Signature count is public." — plan.docx §4.
 *
 * FOUR RULES THAT ARE NOT OBVIOUS FROM THE TYPES:
 *
 *  1. THE COUNT IS RECOUNTED, NEVER INCREMENTED. `signatureCount` is
 *     a cache of `count(signatures)`. Incrementing drifts the moment
 *     one write is lost, and the whole value of a petition is that
 *     its number is defensible.
 *
 *  2. SIGNING NEEDS AN ACCOUNT. An anonymous signature is one anybody
 *     can add a thousand times, and a number nobody can trust is worse
 *     than no number — it discredits the cause it was meant to help.
 *     Signing ANONYMOUSLY is different and is supported: the name is
 *     withheld from the list, the signature still counts.
 *
 *  3. A MEMBER'S PETITION LANDS PENDING. Same as events. Letting
 *     anyone publish an accusation against a named person or business
 *     instantly, at scale, makes this a defamation surface rather than
 *     a campaigning tool.
 *
 *  4. CLOSED IS READABLE. A petition that has ended keeps its page,
 *     its signatures and its count — that record is the point of
 *     having run it. It simply stops accepting new names.
 */

import { reactionOutcome } from "./reaction-toggle";
import type { ReactionType } from "./reactions";
import { prisma } from "./db";
import { slugify } from "./geography-admin";
import { createForAllAdmins } from "./admin-notifications";
import { isSelectableCategory, openPetitionWhere } from "./petition-categories";
import {
  readVideo,
  resolveAttachedVideo,
  sanitiseImages,
  MAX_GALLERY_PHOTOS,
  type AttachedImage,
  type AttachedVideo,
} from "./attached-media";
import { Prisma, type PetitionStatus } from "@prisma/client";

export const MAX_TITLE = 200;
export const MAX_SUMMARY = 400;
export const MAX_TARGET = 200;
export const MAX_COMMENT = 400;
/**
 * Beyond the cover. Ten is generous for a case that has to be read.
 *
 * Re-exported from attached-media rather than declared here, so
 * petitions, campaigns and places cannot drift to three different
 * numbers.
 */
export const MAX_PHOTOS = MAX_GALLERY_PHOTOS;

const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  coverUrl: true,
  photos: true,
  video: true,
  target: true,
  goal: true,
  status: true,
  countryId: true,
  categoryId: true,
  // `id` is here for the content translator, which keys category
  // names by id like every other category on the site.
  category: { select: { id: true, name: true, slug: true, emoji: true, color: true } },
  closesAt: true,
  signatureCount: true,
  reactionCount: true,
  creatorUserId: true,
  creatorNameSnapshot: true,
  creatorAvatarSnapshot: true,
  createdAt: true,
} as const;

export interface PetitionCard {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  /** Extra photos beyond the cover. Empty when there are none. */
  photos: AttachedImage[];
  video: AttachedVideo | null;
  target: string;
  goal: number | null;
  status: PetitionStatus;
  countryId: string | null;
  /** Null only for petitions that predate categories. */
  category: { id: string; name: string; slug: string; emoji: string | null; color: string | null } | null;
  closesAt: string | null;
  signatureCount: number;
  reactionCount: number;
  creatorUserId: string | null;
  creatorName: string;
  creatorAvatar: string | null;
  createdAt: string;
  /** False once it has closed or passed its deadline. */
  open: boolean;
  isMine: boolean;
}

type CardRow = {
  [K in keyof typeof CARD_SELECT]: unknown;
} & {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  photos: unknown;
  video: unknown;
  target: string;
  goal: number | null;
  status: PetitionStatus;
  countryId: string | null;
  categoryId: string | null;
  category: { id: string; name: string; slug: string; emoji: string | null; color: string | null } | null;
  closesAt: Date | null;
  signatureCount: number;
  reactionCount: number;
  creatorUserId: string | null;
  creatorNameSnapshot: string;
  creatorAvatarSnapshot: string | null;
  createdAt: Date;
};

function readPhotos(raw: unknown): AttachedImage[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((p) => {
    const url = (p as { url?: unknown })?.url;
    if (typeof url !== "string" || !url) return [];
    const alt = (p as { alt?: unknown })?.alt;
    return [{ url, alt: typeof alt === "string" ? alt : null }];
  });
}

/**
 * A deadline in the past closes a petition without anyone acting on
 * it. Checked on read rather than swept by a cron: a background job
 * that misses a run leaves petitions collecting signatures they should
 * not have, and this costs one comparison.
 */
function isOpen(r: { status: PetitionStatus; closesAt: Date | null }): boolean {
  if (r.status !== "APPROVED") return false;
  return !r.closesAt || r.closesAt.getTime() > Date.now();
}

function toCard(r: CardRow, viewerId?: string | null): PetitionCard {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    coverUrl: r.coverUrl,
    // Read defensively: these are JSON columns, so the database will
    // hand back whatever was written, including from an older shape.
    photos: readPhotos(r.photos),
    video: readVideo(r.video),
    target: r.target,
    goal: r.goal,
    status: r.status,
    countryId: r.countryId,
    category: r.category,
    closesAt: r.closesAt?.toISOString() ?? null,
    signatureCount: r.signatureCount,
    reactionCount: r.reactionCount,
    creatorUserId: r.creatorUserId,
    creatorName: r.creatorNameSnapshot,
    creatorAvatar: r.creatorAvatarSnapshot,
    createdAt: r.createdAt.toISOString(),
    open: isOpen(r),
    isMine: !!viewerId && r.creatorUserId === viewerId,
  };
}

/* ── reading ─────────────────────────────────────────────────── */

export async function listPetitions(
  filters: {
    viewerId?: string | null;
    countryId?: string | null;
    /** A PetitionCategory id. The route resolves ?category=<slug> to it. */
    categoryId?: string | null;
    /**
     * Only the ones still taking signatures. The category page uses
     * it, so its list agrees with the number on the tile that got the
     * reader there; the index does not, because its Closed section is
     * the point.
     */
    openOnly?: boolean;
    take?: number;
    /**
     * 1-based page, used with `take` as the page size. Offset paging
     * rather than a cursor because this list is ordered by a stable
     * createdAt and the reader is pressing a button, not scrolling a
     * live wall — the two wall sections use cursors for the reason
     * their own comments give.
     */
    page?: number;
  } = {},
): Promise<PetitionCard[]> {
  const rows = await prisma.petition.findMany({
    where: {
      ...(filters.openOnly ? openPetitionWhere() : { status: "APPROVED" }),
      ...(filters.countryId ? { countryId: filters.countryId } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    },
    // Most-signed first would bury every new petition under the same
    // handful forever, which is the one outcome that stops anyone
    // starting one. Newest first, and the count is on the card.
    orderBy: { createdAt: "desc" },
    skip: (Math.max(1, filters.page ?? 1) - 1) * Math.min(60, filters.take ?? 30),
    take: Math.min(60, filters.take ?? 30),
    select: CARD_SELECT,
  });
  return rows.map((r) => toCard(r as CardRow, filters.viewerId));
}

export async function getPetitionBySlug(slug: string, viewerId?: string | null) {
  const row = await prisma.petition.findUnique({
    where: { slug },
    select: { ...CARD_SELECT, body: true, rejectionReason: true },
  });
  if (!row) return null;

  const card = toCard(row as CardRow, viewerId);
  // A pending or rejected petition is visible to the person who wrote
  // it — otherwise submitting feels like the thing vanished — and to
  // nobody else.
  if (row.status !== "APPROVED" && row.status !== "CLOSED" && !card.isMine) return null;

  const [signed, reacted] = viewerId
    ? await Promise.all([
        prisma.petitionSignature.findUnique({
          where: { petitionId_userId: { petitionId: row.id, userId: viewerId } },
          select: { createdAt: true },
        }),
        prisma.petitionReaction.findUnique({
          where: { petitionId_userId: { petitionId: row.id, userId: viewerId } },
          select: { type: true },
        }),
      ])
    : [null, null];

  return {
    ...card,
    body: row.body as string,
    rejectionReason: card.isMine ? ((row.rejectionReason as string | null) ?? null) : null,
    hasSigned: signed !== null,
    myReaction: (reacted?.type as ReactionType) ?? null,
  };
}

/** The public signer list. Anonymous signatures are counted, not named. */
export async function listSignatures(petitionId: string, take = 50) {
  const rows = await prisma.petitionSignature.findMany({
    where: { petitionId, isAnonymous: false },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, take),
    select: {
      userId: true,
      nameSnapshot: true,
      avatarSnapshot: true,
      comment: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    userId: r.userId,
    name: r.nameSnapshot,
    avatar: r.avatarSnapshot,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
  }));
}

/* ── signing ─────────────────────────────────────────────────── */

export type SignResult =
  | { ok: true; signed: boolean; signatureCount: number }
  | { ok: false; error: "NOT_FOUND" | "CLOSED" };

export async function toggleSignature(opts: {
  slug: string;
  user: { id: string; displayName: string; avatarUrl?: string | null };
  comment?: string | null;
  anonymous?: boolean;
}): Promise<SignResult> {
  const petition = await prisma.petition.findUnique({
    where: { slug: opts.slug },
    select: { id: true, status: true, closesAt: true },
  });
  if (!petition) return { ok: false, error: "NOT_FOUND" };

  const key = {
    petitionId_userId: { petitionId: petition.id, userId: opts.user.id },
  };
  const existing = await prisma.petitionSignature.findUnique({
    where: key,
    select: { userId: true },
  });

  if (existing) {
    // Withdrawing is allowed even after it closes — a signature is
    // consent, and consent has to be revocable after the fact.
    await prisma.petitionSignature.delete({ where: key });
  } else {
    if (!isOpen(petition)) return { ok: false, error: "CLOSED" };
    const comment = (opts.comment ?? "").trim().slice(0, MAX_COMMENT);
    await prisma.petitionSignature.create({
      data: {
        petitionId: petition.id,
        userId: opts.user.id,
        nameSnapshot: opts.user.displayName.slice(0, 120),
        avatarSnapshot: opts.user.avatarUrl ?? null,
        comment: comment || null,
        isAnonymous: !!opts.anonymous,
      },
    });
  }

  // Recount, never increment — see the note at the top.
  const signatureCount = await prisma.petitionSignature.count({
    where: { petitionId: petition.id },
  });
  await prisma.petition.update({
    where: { id: petition.id },
    data: { signatureCount },
  });

  return { ok: true, signed: !existing, signatureCount };
}

/* ── creating ────────────────────────────────────────────────── */

export interface PetitionInput {
  title: string;
  summary?: string | null;
  body: string;
  target: string;
  goal?: number | null;
  countryId?: string | null;
  /** A PetitionCategory id. Required — see submitPetition. */
  categoryId?: string | null;
  closesAt?: string | null;
  coverUrl?: string | null;
  photos?: Array<{ url?: unknown; alt?: unknown }> | null;
  /** An id, never a URL — see `resolveAttachedVideo`. */
  videoAssetId?: string | null;
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "petition";
  let candidate = root;
  let n = 1;
  while (await prisma.petition.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${root}-${++n}`;
  }
  return candidate;
}

export function normalise(input: PetitionInput) {
  const title = input.title.trim().slice(0, MAX_TITLE);
  const target = input.target.trim().slice(0, MAX_TARGET);
  const body = input.body.trim();

  return {
    title,
    target,
    body,
    summary: input.summary?.trim().slice(0, MAX_SUMMARY) || null,
    // A goal of zero or a negative one would render a broken bar, and
    // a goal of ten million discourages the first signature. Clamped
    // rather than rejected — nobody should lose a draft over it.
    goal:
      input.goal && Number.isFinite(input.goal) && input.goal > 0
        ? Math.min(1_000_000, Math.trunc(input.goal))
        : null,
    countryId: input.countryId?.trim() || null,
    categoryId: input.categoryId?.trim() || null,
    closesAt: input.closesAt ? new Date(input.closesAt) : null,
    coverUrl: input.coverUrl?.trim() || null,
    photos: sanitiseImages(input.photos, MAX_PHOTOS),
  };
}

export type CreateResult =
  | { ok: true; slug: string }
  | { ok: false; error: "TITLE" | "TARGET" | "BODY" | "CATEGORY" };

/** A member starts one. Lands PENDING and pings the admins. */
export async function submitPetition(
  input: PetitionInput,
  user: { id: string; displayName: string; avatarUrl?: string | null },
): Promise<CreateResult> {
  const data = normalise(input);
  if (data.title.length < 6) return { ok: false, error: "TITLE" };
  if (data.target.length < 2) return { ok: false, error: "TARGET" };
  if (data.body.length < 40) return { ok: false, error: "BODY" };
  // Checked HERE, not only in the form. The category is what the whole
  // section is browsed by, and an uncategorised petition is invisible
  // to every tile — it exists, and nobody arrives at it. Same rule and
  // same reasoning as events.
  if (!(await isSelectableCategory(data.categoryId))) {
    return { ok: false, error: "CATEGORY" };
  }

  // Throws with something readable if the asset is missing, still
  // converting, or belongs to somebody else. Deliberately before the
  // slug is reserved, so a rejected video doesn't leave one behind.
  const video = await resolveAttachedVideo(input.videoAssetId, user.id);

  const slug = await uniqueSlug(data.title);

  const petition = await prisma.petition.create({
    data: {
      ...data,
      // Prisma's InputJsonValue wants an index signature and these are
      // closed shapes on purpose — cast at the boundary only.
      photos:
        data.photos.length > 0
          ? (data.photos as unknown as Prisma.InputJsonValue)
          : undefined,
      video: video ? (video as unknown as Prisma.InputJsonValue) : undefined,
      slug,
      status: "PENDING",
      creatorUserId: user.id,
      creatorNameSnapshot: user.displayName.slice(0, 120),
      creatorAvatarSnapshot: user.avatarUrl ?? null,
    },
    select: { slug: true, title: true },
  });

  await createForAllAdmins({
    type: "PETITION_PENDING",
    title: "A petition is waiting for review",
    message: `${user.displayName} started “${petition.title}”.`,
    actionUrl: "/admin/petitions?status=PENDING",
  });

  return { ok: true, slug: petition.slug };
}

/** The creator closing their own petition. Admins use the admin lib. */
export async function closePetition(slug: string, userId: string): Promise<boolean> {
  const row = await prisma.petition.findUnique({
    where: { slug },
    select: { id: true, creatorUserId: true, status: true },
  });
  if (!row || row.creatorUserId !== userId || row.status !== "APPROVED") return false;
  await prisma.petition.update({ where: { id: row.id }, data: { status: "CLOSED" } });
  return true;
}

export async function listMyPetitions(userId: string, take = 30): Promise<PetitionCard[]> {
  const rows = await prisma.petition.findMany({
    where: { creatorUserId: userId },
    orderBy: { createdAt: "desc" },
    take,
    select: CARD_SELECT,
  });
  return rows.map((r) => toCard(r as CardRow, userId));
}


/* ── reactions ──────────────────────────────────────────────── */

/**
 * Leave, change or take back a reaction on a petition.
 *
 * A REACTION IS NOT A SIGNATURE, and this function goes out of its way
 * not to blur them. It writes a different table, moves a different
 * counter, and never touches `signatureCount`. The UI keeps them apart
 * too: reacting is offered BELOW the sign action, never as an
 * alternative to it, because a petition that collects taps instead of
 * names has been made worse, not more engaging.
 *
 * Unlike signing, reacting stays open on a CLOSED petition — the ask
 * is over, but "this mattered" is still worth being able to say.
 */
export async function togglePetitionReaction(
  userId: string,
  petitionId: string,
  rawType?: unknown,
): Promise<{ reacted: boolean; reactionCount: number; myReaction: ReactionType | null }> {
  const p = await prisma.petition.findUnique({
    where: { id: petitionId },
    select: { status: true },
  });
  if (!p || (p.status !== "APPROVED" && p.status !== "CLOSED")) {
    throw new Error("This petition isn't available.");
  }

  const key = { petitionId_userId: { petitionId, userId } };
  const existing = await prisma.petitionReaction.findUnique({
    where: key,
    select: { type: true },
  });
  const outcome = reactionOutcome((existing?.type as ReactionType) ?? null, rawType);

  if (outcome.kind === "removed") await prisma.petitionReaction.delete({ where: key });
  else if (outcome.kind === "changed")
    await prisma.petitionReaction.update({ where: key, data: { type: outcome.type } });
  else await prisma.petitionReaction.create({ data: { petitionId, userId, type: outcome.type } });

  // Recounted, never incremented — the same rule the file opens with
  // for signatures, and for the same reason.
  const reactionCount = await prisma.petitionReaction.count({ where: { petitionId } });
  await prisma.petition.update({ where: { id: petitionId }, data: { reactionCount } });

  return {
    reacted: outcome.kind !== "removed",
    reactionCount,
    myReaction: outcome.kind === "removed" ? null : outcome.type,
  };
}
