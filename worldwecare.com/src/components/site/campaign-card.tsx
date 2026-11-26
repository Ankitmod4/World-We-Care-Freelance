"use client";

/**
 * The campaign card.
 *
 * Lives here rather than in campaigns-client.tsx because the index no
 * longer lists campaigns at all — it is category tiles only — so the
 * card's one remaining home is the category page. Leaving it in a file
 * that no longer renders it would be a trail to nowhere.
 */

import Link from "next/link";
import { Img } from "@/components/ui/img";
import { useT } from "./locale-context";
import { TranslatedContent } from "./translated-content";

export interface CampaignCard {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  emoji: string | null;
  startsAt: string | null;
  endsAt: string | null;
  supporterCount: number;
  supporting: boolean;
  finished: boolean;
  category: { id: string; name: string; slug: string; emoji: string | null; color: string | null } | null;
  _count: { articles: number; events: number };
}

export function CampaignTile({ campaign }: { campaign: CampaignCard }) {
  const t = useT();
  const parts: string[] = [];
  if (campaign._count.articles) {
    parts.push(t("campaigns.nReads", "{n} read", { n: campaign._count.articles }));
  }
  if (campaign._count.events) {
    parts.push(
      campaign._count.events === 1
        ? t("campaigns.oneEvent", "1 event")
        : t("campaigns.nEvents", "{n} events", { n: campaign._count.events }),
    );
  }

  return (
    <Link
      href={`/campaigns/${campaign.slug}`}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card transition-shadow duration-200 hover:shadow-elevated ${
        campaign.finished ? "opacity-75" : ""
      }`}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[color:var(--color-surface-muted)]">
        {campaign.coverUrl ? (
          <Img
            src={campaign.coverUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[color:var(--color-brand-soft)] to-[color:var(--color-surface-muted)] text-[34px]">
            {campaign.emoji ?? "📣"}
          </span>
        )}
        {campaign.finished && (
          <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
            {t("campaignDetail.finished", "Finished")}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[16.5px] font-semibold leading-snug tracking-[-0.01em]">
          {campaign.emoji && !campaign.coverUrl ? "" : campaign.emoji ? `${campaign.emoji} ` : ""}
          <TranslatedContent kind="campaign" id={campaign.id} field="title" text={campaign.title} toggle={false} />
        </h3>
        {campaign.summary && (
          <p className="mt-1 line-clamp-2 text-[13.5px] text-[color:var(--color-text-muted)]">
            <TranslatedContent kind="campaign" id={campaign.id} field="summary" text={campaign.summary} toggle={false} />
          </p>
        )}
        {/*
          The category, on the card. The tiles are how a reader gets
          INTO a category; this is how they know which one they ended
          up in when they arrived from somewhere else — the index, a
          search, a shared link. Petition cards carry the same label
          for the same reason.
        */}
        {campaign.category && (
          <p className="mt-2 text-[11.5px] font-medium text-[color:var(--color-text-subtle)]">
            {campaign.category.emoji ? `${campaign.category.emoji} ` : ""}
            <TranslatedContent
              kind="campaignCategory"
              id={campaign.category.id}
              field="name"
              text={campaign.category.name}
              toggle={false}
            />
          </p>
        )}
        <p className="mt-auto pt-3 text-[11.5px] tabular-nums text-[color:var(--color-text-subtle)]">
          {campaign.supporterCount === 1
            ? t("campaigns.oneSupporter", "1 supporter")
            : t("campaigns.nSupporters", "{n} supporters", { n: campaign.supporterCount })}
          {parts.length > 0 ? ` \u00b7 ${parts.join(" \u00b7 ")}` : ""}
          {campaign.supporting ? ` \u00b7 ${t("campaigns.youreBehindThis", "you\u2019re behind this")}` : ""}
        </p>
      </div>
    </Link>
  );
}
