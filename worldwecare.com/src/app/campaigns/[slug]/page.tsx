import type { Metadata } from "next";
import { readGallery } from "@/lib/attached-media";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { getCampaignBySlug } from "@/lib/campaigns";
import { eventDateParts, formatEventTime } from "@/lib/timezone";
import {
  CampaignDetailClient,
  type CampaignDetail,
} from "@/components/site/campaign-detail-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // NO viewer id, deliberately. Metadata is what a link preview shows
  // when the URL is pasted anywhere, so it must only ever resolve a
  // PUBLISHED campaign — a pending one would leak its title and cover
  // into every chat window it was shared in. The submitter still sees
  // the page itself; they just get the generic tab title with it.
  const campaign = await getCampaignBySlug(slug);
  const t = await getT();
  return {
    title: campaign ? campaign.title : t("page.campaign.title", "Campaign"),
    description: campaign?.summary ?? undefined,
    // A campaign is meant to be shared, so give the link something to
    // show when it lands in a message.
    openGraph: campaign
      ? {
          title: campaign.title,
          description: campaign.summary ?? undefined,
          images: campaign.coverUrl ? [campaign.coverUrl] : undefined,
        }
      : undefined,
  };
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const t = await getT();
  const { slug } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) redirect(`/login?next=/campaigns/${slug}`);

  const campaign = await getCampaignBySlug(slug, viewer.id);
  if (!campaign) notFound();

  // Dates cross the boundary already formatted.
  //
  // Each event has its OWN timezone, so the label has to be built
  // where that zone is known — and building it here, once, on the
  // server, is also what stops the client re-deriving it in a
  // different locale and tripping a hydration mismatch.
  const payload = {
    ...campaign,
    // A JSON column: read defensively into the gallery's shape rather
    // than casting and hoping.
    photos: readGallery(campaign.photos),
    startsAt: campaign.startsAt ? campaign.startsAt.toISOString() : null,
    endsAt: campaign.endsAt ? campaign.endsAt.toISOString() : null,
    events: campaign.events.map((e) => {
      const parts = eventDateParts(e.startsAt, e.timezone);
      return {
        ...e,
        dayLabel: parts.day,
        monthLabel: parts.month,
        timeLabel: formatEventTime(e.startsAt, e.timezone),
        placeLabel: e.isOnline
          ? t("events.online", "Online")
          : [e.venueName, e.city].filter(Boolean).join(" · ") ||
            t("events.locationTbc", "Location TBC"),
      };
    }),
  } as unknown as CampaignDetail;

  return <CampaignDetailClient viewer={viewer} campaign={payload} />;
}
