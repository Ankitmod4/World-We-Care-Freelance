/**
 * Awareness campaigns — admin side.
 *
 * CRUD for the campaign's own fields, plus attach/detach for the parts
 * it pulls together. The attachment writes are deliberately dumb join
 * rows: no snapshotting, no copying of titles, nothing that could
 * drift out of step with the article or event it points at.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { deleteMediaByUrls, extractLocalImageUrls } from "./media";
import { attachedImageUrls, sanitiseImages, MAX_GALLERY_PHOTOS } from "./attached-media";
import { slugify } from "./geography-admin";
import { isSelectableCategory } from "./campaign-categories";
import { createUserNotification } from "./notifications";

export type CampaignStatusValue =
  | "PENDING"
  | "DRAFT"
  | "PUBLISHED"
  | "REJECTED"
  | "ARCHIVED";

export interface CampaignWriteInput {
  title: string;
  /** What it is organised around. Required on create and to publish. */
  categoryId?: string | null;
  summary?: string | null;
  body?: string | null;
  coverUrl?: string | null;
  /** Extra photos beyond the cover. Capped at MAX_GALLERY_PHOTOS. */
  photos?: Array<{ url?: unknown; alt?: unknown }> | null;
  emoji?: string | null;
  callToAction?: string | null;
  ctaUrl?: string | null;
  status?: CampaignStatusValue;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  countryId?: string | null;
  chatRoomId?: string | null;
  petitionId?: string | null;
}

async function uniqueCampaignSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "campaign";
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await prisma.campaign.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

function clean(v: string | null | undefined, max = 500): string | null {
  const t = v?.trim();
  return t ? t.slice(0, max) : null;
}

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalise(input: CampaignWriteInput) {
  const title = input.title?.trim();
  if (!title) throw new Error("Title is required");

  const startsAt = toDate(input.startsAt);
  const endsAt = toDate(input.endsAt);
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new Error("The end date is before the start date.");
  }

  const ctaUrl = clean(input.ctaUrl);
  if (ctaUrl && !/^https?:\/\//i.test(ctaUrl) && !ctaUrl.startsWith("/")) {
    // A call-to-action that silently does nothing is worse than one
    // that refuses to save.
    throw new Error("The action link must start with https:// or be a path beginning with /");
  }

  return {
    title: title.slice(0, 200),
    summary: clean(input.summary, 400),
    body: clean(input.body, 40_000),
    coverUrl: clean(input.coverUrl),
    // Capped and stripped of anything without a usable url — the same
    // gate events and petitions use, so one bad entry cannot persist a
    // gallery the reader side then has to defend against.
    /*
     * Cast HERE, not at each call site.
     *
     * Prisma's InputJsonValue wants an index signature and
     * AttachedImage is a closed shape on purpose, so the conversion
     * has to happen somewhere; doing it once in normalise means
     * create, update and submit all get the same value. Same trick
     * `hours` already uses two lines down.
     *
     * `DbNull` and not `undefined` when the gallery is empty:
     * undefined means "leave the column alone" on an update, so an
     * admin removing the last photo would silently keep it.
     */
    photos: ((): Prisma.InputJsonValue | typeof Prisma.DbNull => {
      const list = sanitiseImages(input.photos, MAX_GALLERY_PHOTOS);
      return list.length ? (list as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
    })(),
    emoji: clean(input.emoji, 8),
    callToAction: clean(input.callToAction, 120),
    ctaUrl,
    status: input.status ?? "DRAFT",
    startsAt,
    endsAt,
    countryId: clean(input.countryId, 60),
    categoryId: clean(input.categoryId, 60),
    chatRoomId: clean(input.chatRoomId, 60),
    petitionId: clean(input.petitionId, 60),
  };
}

/**
 * Nothing NEW and nothing PUBLIC without a category.
 *
 * Two rules rather than one, because the campaigns that already exist
 * have no category and are not going to grow one on their own:
 *
 *  - CREATE always requires it. There is no such thing as a new
 *    campaign nobody can find.
 *  - PUBLISHING requires it. That is the moment a campaign becomes
 *    something readers browse for, and a published campaign under no
 *    tile is one nobody arrives at.
 *
 * An existing row can therefore still be edited and saved as a draft
 * while somebody works out where it belongs — but it cannot go live
 * that way. The admin list's Uncategorised filter is how you find them.
 */
async function assertCategory(
  categoryId: string | null,
  opts: { creating: boolean; publishing: boolean },
) {
  if (!opts.creating && !opts.publishing) return;
  if (!categoryId) {
    throw new Error(
      opts.creating
        ? "Choose what this campaign is about."
        : "Choose a category before publishing — otherwise it won't appear under any tile.",
    );
  }
  if (!(await isSelectableCategory(categoryId))) {
    throw new Error("That category is no longer available. Pick another.");
  }
}

/* ── read ────────────────────────────────────────────────────── */

export async function listAdminCampaigns(
  filters: {
    status?: CampaignStatusValue | "ALL";
    /** The backlog: rows with no category, which no tile can reach. */
    uncategorised?: boolean;
  } = {},
) {
  return prisma.campaign.findMany({
    where: {
      ...(filters.status && filters.status !== "ALL" ? { status: filters.status } : {}),
      ...(filters.uncategorised ? { categoryId: null } : {}),
    },
    // PENDING first whatever else is showing: a submission is somebody
    // waiting on us, and it should not sort below a draft nobody has
    // touched since March.
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      coverUrl: true,
      emoji: true,
      status: true,
      startsAt: true,
      endsAt: true,
      supporterCount: true,
      updatedAt: true,
      createdAt: true,
      reviewNote: true,
      submittedByUserId: true,
      submitterNameSnapshot: true,
      category: { select: { id: true, name: true, slug: true, emoji: true } },
      _count: { select: { articles: true, events: true } },
    },
  });
}

/** How many submissions are waiting — for the sidebar's badge. */
export async function countPendingCampaigns(): Promise<number> {
  return prisma.campaign.count({ where: { status: "PENDING" } });
}

export async function getAdminCampaign(id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      articles: {
        orderBy: { sortOrder: "asc" },
        select: {
          sortOrder: true,
          article: { select: { id: true, title: true, slug: true, status: true, coverUrl: true } },
        },
      },
      events: {
        orderBy: { sortOrder: "asc" },
        select: {
          sortOrder: true,
          event: { select: { id: true, title: true, slug: true, status: true, startsAt: true, coverUrl: true } },
        },
      },
    },
  });
  if (!campaign) return null;

  const room = campaign.chatRoomId
    ? await prisma.chatRoom.findUnique({
        where: { id: campaign.chatRoomId },
        select: { id: true, name: true, slug: true },
      })
    : null;

  return { ...campaign, room };
}

/* ── write ───────────────────────────────────────────────────── */

export async function createCampaign(input: CampaignWriteInput, adminId?: string) {
  const data = normalise(input);
  await assertCategory(data.categoryId, {
    creating: true,
    publishing: data.status === "PUBLISHED",
  });
  const slug = await uniqueCampaignSlug(data.title);
  return prisma.campaign.create({
    data: {
      ...data,
      slug,
      publishedAt: data.status === "PUBLISHED" ? new Date() : null,
      createdByAdminId: adminId ?? null,
    },
    select: { id: true, slug: true },
  });
}

export async function updateCampaign(id: string, input: Partial<CampaignWriteInput>) {
  const current = await prisma.campaign.findUnique({ where: { id } });
  if (!current) throw new Error("Campaign not found");

  // Validate the MERGED result, so a partial update can't leave the row
  // in a state a create would have refused.
  const merged = normalise({
    title: input.title ?? current.title,
    summary: input.summary !== undefined ? input.summary : current.summary,
    body: input.body !== undefined ? input.body : current.body,
    coverUrl: input.coverUrl !== undefined ? input.coverUrl : current.coverUrl,
    photos:
      input.photos !== undefined
        ? input.photos
        : (current.photos as Array<{ url?: unknown; alt?: unknown }> | null),
    emoji: input.emoji !== undefined ? input.emoji : current.emoji,
    callToAction: input.callToAction !== undefined ? input.callToAction : current.callToAction,
    ctaUrl: input.ctaUrl !== undefined ? input.ctaUrl : current.ctaUrl,
    status: input.status ?? (current.status as CampaignStatusValue),
    startsAt: input.startsAt !== undefined ? input.startsAt : current.startsAt,
    endsAt: input.endsAt !== undefined ? input.endsAt : current.endsAt,
    countryId: input.countryId !== undefined ? input.countryId : current.countryId,
    chatRoomId: input.chatRoomId !== undefined ? input.chatRoomId : current.chatRoomId,
    petitionId: input.petitionId !== undefined ? input.petitionId : current.petitionId,
    categoryId: input.categoryId !== undefined ? input.categoryId : current.categoryId,
  });

  await assertCategory(merged.categoryId, {
    creating: false,
    // Only when this save is what makes it public. Re-saving a row
    // that was already published does not get a free pass — a
    // published campaign should have a category either way — but a
    // row going PUBLISHED now is the moment it must.
    publishing: merged.status === "PUBLISHED",
  });

  return prisma.campaign.update({
    where: { id },
    data: {
      ...merged,
      // Stamp the first publication only; re-publishing keeps the
      // original moment, so the index ordering doesn't jump around.
      publishedAt:
        merged.status === "PUBLISHED" ? (current.publishedAt ?? new Date()) : current.publishedAt,
    },
    select: { id: true, slug: true },
  });
}

export async function deleteCampaign(id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { coverUrl: true, photos: true, body: true },
  });

  // Join rows and supports cascade. The articles, events and chatroom
  // themselves are NOT touched — they belong to other features and
  // outlive the campaign that borrowed them.
  await prisma.campaign.delete({ where: { id } });

  await deleteMediaByUrls(
    // The GALLERY too. Without it, deleting a campaign leaves every
    // photo but the cover on disk with nothing pointing at it.
    [
      campaign?.coverUrl,
      ...attachedImageUrls(campaign?.photos),
      ...extractLocalImageUrls(campaign?.body),
    ],
    { allowAnyOwner: true },
  );
}

/**
 * Approve or reject a campaign a member sent in.
 *
 * APPROVING PUBLISHES IT. There is no intermediate "approved but not
 * live" state for submissions, because there is nothing left to do
 * between the two — an admin who wants to hold one back can move it
 * to DRAFT from the form instead.
 *
 * A campaign cannot be approved without a category, for the same
 * reason `assertCategory` gives: it would go live under no tile. The
 * review screen therefore lets the admin set one AS they approve,
 * which is also the moment they know what it should be.
 *
 * REJECTING KEEPS THE ROW. The submitter is told why, and can read the
 * reason on their own copy of the page — which is what
 * `getCampaignBySlug` widens its where clause for. Deleting instead
 * would leave them with a 404 and no idea what happened.
 */
export async function reviewCampaign(
  id: string,
  adminId: string,
  action: "approve" | "reject",
  opts: { reason?: string; categoryId?: string | null } = {},
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      categoryId: true,
      publishedAt: true,
      submittedByUserId: true,
    },
  });
  if (!campaign) throw new Error("Campaign not found");

  const categoryId =
    opts.categoryId !== undefined ? clean(opts.categoryId, 60) : campaign.categoryId;

  if (action === "approve") {
    await assertCategory(categoryId, { creating: false, publishing: true });
  }

  const status: CampaignStatusValue = action === "approve" ? "PUBLISHED" : "REJECTED";
  // Kept on an approval too: "looks good, chased the organiser about
  // the dates" is worth having next to the row.
  const note = clean(opts.reason, 2000);

  await prisma.campaign.update({
    where: { id },
    data: {
      status,
      categoryId,
      reviewNote: note,
      reviewedAt: new Date(),
      reviewedByAdminId: adminId,
      // First publication only, so the index ordering does not jump
      // around if it is ever unpublished and approved again.
      publishedAt:
        action === "approve" ? (campaign.publishedAt ?? new Date()) : campaign.publishedAt,
    },
  });

  if (campaign.submittedByUserId) {
    await createUserNotification({
      userId: campaign.submittedByUserId,
      type: action === "approve" ? "CAMPAIGN_APPROVED" : "CAMPAIGN_REJECTED",
      title: action === "approve" ? "Your campaign is live" : "Your campaign wasn't approved",
      body:
        action === "approve"
          ? `“${campaign.title}” is now on the campaigns page.`
          : note
            ? `Reason: ${note}`
            : "It didn't meet our community guidelines.",
      actionUrl: `/campaigns/${campaign.slug}`,
    });
  }

  return { status };
}

/* ── attachments ─────────────────────────────────────────────── */

export async function attachArticle(campaignId: string, articleId: string) {
  const article = await prisma.article.findUnique({ where: { id: articleId }, select: { id: true } });
  if (!article) throw new Error("Article not found");
  const last = await prisma.campaignArticle.aggregate({
    where: { campaignId },
    _max: { sortOrder: true },
  });
  await prisma.campaignArticle.upsert({
    where: { campaignId_articleId: { campaignId, articleId } },
    create: { campaignId, articleId, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    update: {},
  });
}

export async function detachArticle(campaignId: string, articleId: string) {
  await prisma.campaignArticle
    .delete({ where: { campaignId_articleId: { campaignId, articleId } } })
    .catch(() => {});
}

export async function attachEvent(campaignId: string, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) throw new Error("Event not found");
  const last = await prisma.campaignEvent.aggregate({
    where: { campaignId },
    _max: { sortOrder: true },
  });
  await prisma.campaignEvent.upsert({
    where: { campaignId_eventId: { campaignId, eventId } },
    create: { campaignId, eventId, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    update: {},
  });
}

export async function detachEvent(campaignId: string, eventId: string) {
  await prisma.campaignEvent
    .delete({ where: { campaignId_eventId: { campaignId, eventId } } })
    .catch(() => {});
}

export async function reorderAttachments(
  campaignId: string,
  kind: "articles" | "events",
  orderedIds: string[],
): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      kind === "articles"
        ? prisma.campaignArticle.updateMany({
            where: { campaignId, articleId: id },
            data: { sortOrder: index },
          })
        : prisma.campaignEvent.updateMany({
            where: { campaignId, eventId: id },
            data: { sortOrder: index },
          }),
    ),
  );
}

/** Candidates for the attachment pickers. */
export async function searchAttachables(q: string) {
  const term = q.trim();
  const [articles, events, rooms] = await Promise.all([
    prisma.article.findMany({
      where: term ? { title: { contains: term } } : {},
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: { id: true, title: true, slug: true, status: true, coverUrl: true },
    }),
    prisma.event.findMany({
      where: term ? { title: { contains: term } } : {},
      orderBy: { startsAt: "desc" },
      take: 12,
      select: { id: true, title: true, slug: true, status: true, startsAt: true, coverUrl: true },
    }),
    prisma.chatRoom.findMany({
      where: term ? { name: { contains: term } } : {},
      orderBy: { name: "asc" },
      take: 12,
      select: { id: true, name: true, slug: true },
    }),
  ]);
  return { articles, events, rooms };
}
