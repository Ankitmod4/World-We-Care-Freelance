"use client";

/**
 * /campaigns — the index.
 *
 * A TAB STRIP OVER THE LIST. This page was briefly tiles and nothing
 * else, on the argument that the way to a campaign is to pick what it
 * is about first. That held while the categories were a grid of doors;
 * with a strip there is a row of tabs and the campaigns underneath,
 * which answers the same question without spending the screen on it.
 *
 * THE LIST BEING BACK ALSO FIXES SOMETHING THE TILE VERSION BROKE: a
 * campaign with no category had no tile to sit under and no list to
 * fall into, so it was unreachable from here. Under "All" it is
 * visible again. Category is still required to create or publish one,
 * so that state only exists for rows that predate categories.
 *
 * Counts follow the country selector, because a tab saying 12 over a
 * list showing none is the country filter lying about itself.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { useCountry } from "./country-context";
import { PageHeading } from "./page-heading";
import { CategoryBrowse } from "./category-browse";
import { CampaignTile, type CampaignCard } from "./campaign-card";
import type { PublicCampaignCategory } from "@/lib/campaign-categories";
import { useT } from "./locale-context";
import { TranslatedContent } from "./translated-content";

export function CampaignsClient({
  viewer,
  mine,
}: {
  viewer: ShellViewer;
  /**
   * This member's own submissions that are not public yet. Read on the
   * server, because it is scoped to them and has no business being a
   * client fetch that could be pointed at somebody else's id.
   */
  mine: Array<{ id: string; slug: string; title: string; status: "PENDING" | "REJECTED" }>;
}) {
  const t = useT();
  const { countryId, country } = useCountry();
  const [categories, setCategories] = useState<PublicCampaignCategory[] | null>(null);

  const load = useCallback(async () => {
    setCategories(null);
    const params = new URLSearchParams();
    if (countryId) params.set("countryId", countryId);
    const res = await fetch(`/api/public/campaign-categories?${params}`, {
      cache: "no-store",
    }).catch(() => null);
    const d = (await res?.json().catch(() => ({}))) as { categories?: PublicCampaignCategory[] };
    setCategories(d.categories ?? []);
  }, [countryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const fetchPage = useCallback(
    async (slug: string | null, page: number) => {
      const params = new URLSearchParams({ page: String(page), take: "12" });
      if (countryId) params.set("countryId", countryId);
      if (slug) params.set("category", slug);
      const res = await fetch(`/api/user/campaigns?${params}`, { cache: "no-store" }).catch(
        () => null,
      );
      const d = (await res?.json().catch(() => ({}))) as { campaigns?: CampaignCard[] };
      return { items: d.campaigns ?? [] };
    },
    [countryId],
  );

  return (
    <SiteShell viewer={viewer}>
      <PageHeading
        title={t("page.campaignsTitle", "Campaigns")}
        intro={t("page.campaignsIntro", "Causes the community is behind{country} — the reading, the events and the conversation, in one place.")}
        country={country?.name}
        actions={
          <Link
            href="/campaigns/new"
            className="inline-flex h-10 shrink-0 items-center rounded-full bg-[color:var(--color-brand)] px-4 text-[13.5px] font-semibold text-[color:var(--color-on-brand)] transition-colors hover:bg-[color:var(--color-brand-hover)]"
          >
            {t("campaigns.start", "Start a campaign")}
          </Link>
        }
      />

      {/*
        THE MEMBER'S OWN, FIRST AND WITHOUT WAITING FOR THE FETCH.
        A campaign in review is under no tile — it is not published, so
        it is not counted — and nothing else links to it. This strip is
        the only way back to something they wrote. Server-rendered, so
        it is there on the first paint rather than a beat later.
      */}
      {mine.length > 0 && (
        <div className="mb-5 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-4 shadow-card">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
            {t("campaigns.yours", "Yours")}
          </h2>
          <ul className="mt-2 space-y-1.5">
            {mine.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${
                    c.status === "PENDING"
                      ? "bg-[color:var(--color-brand)]/12 text-[color:var(--color-brand)]"
                      : "bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]"
                  }`}
                >
                  {c.status === "PENDING" ? t("common.inReview", "In review") : t("common.notApproved", "Not approved")}
                </span>
                <Link
                  href={`/campaigns/${c.slug}`}
                  className="min-w-0 truncate text-[13.5px] font-medium hover:text-[color:var(--color-brand)]"
                >
                  <TranslatedContent kind="campaign" id={c.id} field="title" text={c.title} toggle={false} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CategoryBrowse
        kind="campaignCategory"
        categories={(categories ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          emoji: c.emoji,
          count: c.liveCount,
        }))}
        label={t("campaigns.categories", "Campaign categories")}
        layout="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]"
        fetchPage={fetchPage}
        renderItem={(c) => <CampaignTile key={c.id} campaign={c} />}
        empty={(slug) => (
          <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center shadow-card">
            <p className="text-[15px] font-medium">
              {slug ? t("common.nothingHere", "Nothing here yet") : t("campaigns.none", "No campaigns yet")}
            </p>
            <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">
              {t("campaigns.emptyBlurb", "Start one, or pick another category above.")}
            </p>
            <Link
              href="/campaigns/new"
              className="mt-4 inline-flex h-10 items-center rounded-full bg-[color:var(--color-brand)] px-4 text-[13.5px] font-semibold text-[color:var(--color-on-brand)] transition-colors hover:bg-[color:var(--color-brand-hover)]"
            >
              {t("campaigns.start", "Start a campaign")}
            </Link>
          </div>
        )}
      />
    </SiteShell>
  );
}
