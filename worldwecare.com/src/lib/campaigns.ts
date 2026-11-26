/**
 * Awareness campaigns — reader side.
 *
 * A campaign is an aggregator: it owns a title, a cover and some copy,
 * and everything else on its page is a row that already exists as an
 * article, a chatroom or an event.
 *
 * That has one consequence worth stating, because it is the whole
 * design: attachments are resolved at READ time and anything that has
 * since been unpublished, cancelled or deleted is simply dropped. A
 * campaign never holds a snapshot of an article's title, because then
 * there would be two titles and one of them would be wrong.
 */

import { prisma } from "./db";
import { isSelectableCategory, liveCampaignWhere } from "./campaign-categories";
import { sanitiseImages, MAX_GALLERY_PHOTOS } from "./attached-media";
import { createForAllAdmins } from "./admin-notifications";
import { slugify } from "./geography-admin";
import { Prisma } from "@prisma/client";

const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  coverUrl: true,
  emoji: true,
  status: true,
  publishedAt: true,
  startsAt: true,
  endsAt: true,
  countryId: true,
  supporterCount: true,
  category: { select: { id: true, name: true, slug: true, emoji: true, color: true } },
} as const;

export type CampaignCard = Awaited<ReturnType<typeof listCampaigns>>[number];

/** A campaign is "over" once its end date has passed. */
export function isFinished(endsAt: Date | string | null): boolean {
  if (!endsAt) return false;
  return new Date(endsAt).getTime() < Date.now();
}

export async function listCampaigns(
  opts: {
    countryId?: string | null;
    viewerId?: string | null;
    /** One category, for its page. Ignored when null. */
    categoryId?: string | null;
    /** Drop the ones whose end date has passed. The tiles count these. */
    liveOnly?: boolean;
    take?: number;
    /** 1-based page, used with `take` as the page size. */
    page?: number;
  } = {},
) {
  const campaigns = await prisma.campaign.findMany({
    where: {
      status: "PUBLISHED",
      ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
      // `liveCampaignWhere` carries a status of its own and an OR over
      // the end date; spread AFTER the status above so the two agree,
      // and keep the country OR in a separate AND arm so one OR does
      // not overwrite the other.
      ...(opts.liveOnly ? liveCampaignWhere() : {}),
      ...(opts.countryId
        ? { AND: [{ OR: [{ countryId: opts.countryId }, { countryId: null }] }] }
        : {}),
    },
    ...(opts.take ? { take: opts.take, skip: (Math.max(1, opts.page ?? 1) - 1) * opts.take } : {}),
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      ...CARD_SELECT,
      _count: { select: { articles: true, events: true } },
    },
  });

  const supported = opts.viewerId
    ? new Set(
        (
          await prisma.campaignSupport.findMany({
            where: { userId: opts.viewerId, campaignId: { in: campaigns.map((c) => c.id) } },
            select: { campaignId: true },
          })
        ).map((s) => s.campaignId),
      )
    : new Set<string>();

  return campaigns.map((c) => ({
    ...c,
    supporting: supported.has(c.id),
    finished: isFinished(c.endsAt),
  }));
}

/**
 * The campaign page: the campaign plus everything currently attached
 * to it that is still fit to show.
 */
export async function getCampaignBySlug(slug: string, viewerId?: string | null) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      slug,
      // PUBLISHED for everyone — plus, for the person who sent it in,
      // their OWN campaign while it is still waiting or after it was
      // turned down. Without this the submit flow ends on a 404 of the
      // thing they just wrote, and a rejection can never be read.
      //
      // Scoped by `submittedByUserId`, NOT by "is signed in": the
      // second one would publish every pending campaign to every
      // member, which is the whole point of having a review step.
      OR: [
        { status: "PUBLISHED" },
        // Two arms rather than a `status: { in: [...] }`, because a
        // literal array widens to readonly and Prisma's filter wants a
        // mutable one. Spelling them out also makes it impossible to
        // drop the `submittedByUserId` from one of them by accident.
        ...(viewerId
          ? [
              { status: "PENDING" as const, submittedByUserId: viewerId },
              { status: "REJECTED" as const, submittedByUserId: viewerId },
            ]
          : []),
      ],
    },
    select: {
      ...CARD_SELECT,
      body: true,
      // Only ever read by the submitter (see the where clause) and by
      // admin screens, which use their own query.
      reviewNote: true,
      submittedByUserId: true,
      submitterNameSnapshot: true,
      submitterAvatarSnapshot: true,
      // The gallery is on the detail page only — the card has the
      // cover and nothing else, so listing pages do not pay for a
      // JSON column they never render.
      photos: true,
      callToAction: true,
      ctaUrl: true,
      chatRoomId: true,
      petitionId: true,
      createdAt: true,
      articles: {
        orderBy: { sortOrder: "asc" },
        select: {
          sortOrder: true,
          article: {
            select: {
              id: true,
              slug: true,
              title: true,
              excerpt: true,
              coverUrl: true,
              readMinutes: true,
              status: true,
              publishedAt: true,
              category: { select: { name: true, slug: true } },
            },
          },
        },
      },
      events: {
        orderBy: { sortOrder: "asc" },
        select: {
          sortOrder: true,
          event: {
            select: {
              id: true,
              slug: true,
              title: true,
              summary: true,
              coverUrl: true,
              startsAt: true,
              endsAt: true,
              timezone: true,
              isOnline: true,
              venueName: true,
              city: true,
              rsvpCount: true,
              capacity: true,
              status: true,
            },
          },
        },
      },
    },
  });
  if (!campaign) return null;

  const [supporting, room, petition] = await Promise.all([
    viewerId
      ? prisma.campaignSupport.findUnique({
          where: { campaignId_userId: { campaignId: campaign.id, userId: viewerId } },
          select: { userId: true },
        })
      : null,
    // Loose FK — the room may have been deleted since it was attached.
    campaign.chatRoomId
      ? prisma.chatRoom.findUnique({
          where: { id: campaign.chatRoomId },
          select: { id: true, slug: true, name: true, description: true, memberCount: true },
        })
      : null,
    // Same loose-FK treatment as the room: resolved here, and simply
    // absent from the page if it has since been deleted or is not
    // approved. This is the column the schema left waiting.
    campaign.petitionId
      ? prisma.petition.findUnique({
          where: { id: campaign.petitionId },
          select: {
            id: true,
            slug: true,
            title: true,
            target: true,
            goal: true,
            signatureCount: true,
            status: true,
          },
        })
      : null,
  ]);

  return {
    ...campaign,
    // Drop anything the reader shouldn't see. An article pulled back to
    // draft, or a cancelled event, silently leaves the campaign page
    // rather than 404-ing from it.
    articles: campaign.articles
      .filter((a) => a.article && a.article.status === "PUBLISHED")
      .map((a) => a.article),
    events: campaign.events
      .filter((e) => e.event && e.event.status === "APPROVED")
      .map((e) => e.event),
    room,
    // A pending or rejected petition is not shown on someone else's
    // campaign page — the campaign should not be the back door that
    // publishes it early.
    petition: petition && petition.status === "APPROVED" ? petition : null,
    supporting: !!supporting,
    finished: isFinished(campaign.endsAt),
  };
}

export async function toggleCampaignSupport(campaignId: string, userId: string) {
  // PUBLISHED ONLY.
  //
  // The id comes off a URL, so without this anyone who has one can put
  // supporters on a campaign that is still in review — including its
  // own author, who would then be looking at a submission that already
  // claims backing nobody gave it. `supporterCount` is shown on the
  // card and read as a fact about the cause.
  const live = await prisma.campaign.findFirst({
    where: { id: campaignId, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!live) throw new Error("Campaign not found");

  const key = { campaignId_userId: { campaignId, userId } };
  const existing = await prisma.campaignSupport.findUnique({ where: key, select: { userId: true } });

  if (existing) await prisma.campaignSupport.delete({ where: key });
  else await prisma.campaignSupport.create({ data: { campaignId, userId } });

  // Recount rather than increment — self-healing if a write is lost.
  const supporterCount = await prisma.campaignSupport.count({ where: { campaignId } });
  await prisma.campaign.update({ where: { id: campaignId }, data: { supporterCount } });
  return { supporting: !existing, supporterCount };
}

/** Campaigns this member supports, for their profile / saved area. */
export async function listSupportedCampaigns(userId: string, take = 30) {
  const rows = await prisma.campaignSupport.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: { campaign: { select: CARD_SELECT } },
  });
  return rows
    .map((r) => r.campaign)
    .filter((c) => c && c.status === "PUBLISHED")
    .map((c) => ({ ...c, supporting: true, finished: isFinished(c.endsAt) }));
}

/* ── member submissions ──────────────────────────────────────── */

export interface CampaignSubmitInput {
  title: string;
  summary?: string | null;
  body: string;
  categoryId?: string | null;
  countryId?: string | null;
  coverUrl?: string | null;
  photos?: Array<{ url?: unknown; alt?: unknown }> | null;
}

export type CampaignSubmitError = "TITLE" | "BODY" | "CATEGORY";

export type CampaignSubmitResult =
  | { ok: true; slug: string }
  | { ok: false; error: CampaignSubmitError };

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "campaign";
  let candidate = root;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await prisma.campaign.findFirst({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

/**
 * A member sends a campaign in. It lands PENDING.
 *
 * WHAT A MEMBER MAY SET IS A SHORT LIST, and the omissions are the
 * design rather than an oversight:
 *
 *  - NO `ctaUrl`. An outbound link on a public page is the single
 *    thing a spam submission wants, and a campaign reads as endorsed
 *    by this place. An admin adds the link at review, having looked
 *    at where it goes.
 *  - NO `status`, `publishedAt`, `startsAt`/`endsAt`. Publishing
 *    yourself is what the review step exists to prevent, and a date
 *    window is a promise the team has to be able to keep.
 *  - NO `chatRoomId`, `petitionId`, articles or events. Those are the
 *    curation that makes a campaign an aggregator rather than a post;
 *    attaching someone else's chatroom to your own campaign is not a
 *    thing to hand out on a public form.
 *
 * Everything here is re-checked server side even though the form
 * checks it too, because the form is not the boundary — a POST is.
 */
export async function submitCampaign(
  input: CampaignSubmitInput,
  user: { id: string; displayName: string; avatarUrl?: string | null },
): Promise<CampaignSubmitResult> {
  const title = (input.title ?? "").trim().slice(0, 200);
  const summary = (input.summary ?? "").trim().slice(0, 400) || null;
  const body = (input.body ?? "").trim().slice(0, 40_000);

  if (title.length < 6) return { ok: false, error: "TITLE" };
  if (body.length < 40) return { ok: false, error: "BODY" };
  // Checked HERE, not only in the form. The category is what the whole
  // section is browsed by, and an uncategorised campaign is invisible
  // to every tile — it exists, and nobody arrives at it. Same rule and
  // same reasoning as petitions and events.
  if (!(await isSelectableCategory(input.categoryId))) {
    return { ok: false, error: "CATEGORY" };
  }

  const photos = sanitiseImages(input.photos, MAX_GALLERY_PHOTOS);
  const slug = await uniqueSlug(title);

  const campaign = await prisma.campaign.create({
    data: {
      slug,
      title,
      summary,
      body,
      categoryId: input.categoryId as string,
      countryId: (input.countryId ?? "").trim() || null,
      coverUrl: (input.coverUrl ?? "").trim() || null,
      // Cast at the boundary: Prisma's InputJsonValue wants an index
      // signature and AttachedImage is a closed shape on purpose.
      photos: photos.length ? (photos as unknown as Prisma.InputJsonValue) : undefined,
      status: "PENDING",
      submittedByUserId: user.id,
      submitterNameSnapshot: user.displayName.slice(0, 120),
      submitterAvatarSnapshot: user.avatarUrl ?? null,
    },
    select: { slug: true, title: true },
  });

  await createForAllAdmins({
    type: "CAMPAIGN_PENDING",
    title: "A campaign is waiting for review",
    message: `${user.displayName} submitted “${campaign.title}”.`,
    actionUrl: "/admin/campaigns?status=PENDING",
  });

  return { ok: true, slug: campaign.slug };
}

/**
 * The submitter's own campaigns, whatever state they are in.
 *
 * Exists so "I sent one in, where did it go?" has an answer that is
 * not a 404. Scoped to `submittedByUserId`, so it can never return
 * somebody else's pending work.
 */
export async function listOwnSubmittedCampaigns(userId: string, take = 20) {
  return prisma.campaign.findMany({
    where: { submittedByUserId: userId },
    orderBy: [{ createdAt: "desc" }],
    take,
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      coverUrl: true,
      status: true,
      reviewNote: true,
      createdAt: true,
      category: { select: { name: true, slug: true, emoji: true } },
    },
  });
}
