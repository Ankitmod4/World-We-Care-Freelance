"use client";

/**
 * A campaign page.
 *
 * Everything below the header belongs to another feature — an article,
 * an event, a chatroom. Each block is a link out to the real thing,
 * never a copy of it. If a section here ever starts rendering an
 * article's body or an event's RSVP control, the campaign has stopped
 * being an aggregator.
 */

import { useState } from "react";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { Markdown } from "@/lib/rich-text";
import { formatDayRangeUTC } from "@/lib/timezone";
import { Img } from "@/components/ui/img";
import { PhotoGallery, type GalleryImage } from "./photo-gallery";
import { useT } from "./locale-context";
import { TranslatedContent } from "./translated-content";
import { TranslatedMarkdown } from "./translated-markdown";
import { DonateButton } from "./donate-button";

export interface CampaignArticleRef {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  readMinutes: number;
  category: { name: string; slug: string } | null;
}

export interface CampaignEventRef {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  /**
   * Pre-formatted on the server. Formatting a date inside a client
   * component that is server-rendered means doing it twice, in two
   * runtimes with different locales — which is a hydration mismatch
   * waiting for a user whose browser disagrees with the server.
   */
  dayLabel: string;
  monthLabel: string;
  timeLabel: string;
  placeLabel: string;
  rsvpCount: number;
}

export interface CampaignDetail {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string | null;
  coverUrl: string | null;
  /** Extra photos beyond the cover. Empty when there are none. */
  photos: GalleryImage[];
  emoji: string | null;
  callToAction: string | null;
  ctaUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  supporterCount: number;
  supporting: boolean;
  finished: boolean;
  /**
   * Only ever anything but PUBLISHED for the person who submitted it
   * — `getCampaignBySlug` is what enforces that, scoped by
   * `submittedByUserId`, and this component trusts it rather than
   * re-checking. See the banner below.
   */
  status: "PENDING" | "DRAFT" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
  /** The moderator's note, shown to the submitter on a rejection. */
  reviewNote: string | null;
  category: { id: string; name: string; slug: string; emoji: string | null; color: string | null } | null;
  articles: CampaignArticleRef[];
  events: CampaignEventRef[];
  room: { id: string; slug: string; name: string; description: string | null; memberCount: number } | null;
  petition: {
    id: string;
    slug: string;
    title: string;
    target: string;
    goal: number | null;
    signatureCount: number;
  } | null;
}

export function CampaignDetailClient({
  viewer,
  campaign: initial,
}: {
  viewer: ShellViewer;
  campaign: CampaignDetail;
}) {
  const t = useT();
  const [campaign, setCampaign] = useState(initial);
  const [copied, setCopied] = useState(false);

  // Deterministic: pinned locale and zone, so SSR and hydration agree.
  const dateRange = formatDayRangeUTC(campaign.startsAt, campaign.endsAt);

  const toggleSupport = async () => {
    const before = { supporting: campaign.supporting, supporterCount: campaign.supporterCount };
    setCampaign((c) => ({
      ...c,
      supporting: !c.supporting,
      supporterCount: c.supporterCount + (c.supporting ? -1 : 1),
    }));
    const res = await fetch(`/api/user/campaigns/${campaign.id}/support`, { method: "POST" }).catch(
      () => null,
    );
    if (!res?.ok) {
      setCampaign((c) => ({ ...c, ...before }));
      return;
    }
    const d = (await res.json().catch(() => ({}))) as {
      supporting?: boolean;
      supporterCount?: number;
    };
    setCampaign((c) => ({
      ...c,
      ...(typeof d.supporting === "boolean" ? { supporting: d.supporting } : {}),
      ...(typeof d.supporterCount === "number" ? { supporterCount: d.supporterCount } : {}),
    }));
  };

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    // The Web Share sheet is what people expect on a phone; the
    // clipboard is the honest desktop fallback.
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      await nav.share({ title: campaign.title, text: campaign.summary ?? "", url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the URL is in the address bar anyway */
    }
  };

  const hasParts =
    campaign.articles.length > 0 ||
    campaign.events.length > 0 ||
    !!campaign.room ||
    !!campaign.petition;

  return (
    <SiteShell viewer={viewer}>
      <div className="pb-6">
        <nav className="mb-3">
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)]"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t("campaignDetail.all", "All campaigns")}
          </Link>
        </nav>

        {/*
          THE SUBMITTER'S OWN COPY, while it waits or after it was
          turned down. Nobody else can reach this page in either state
          — the query is scoped by `submittedByUserId` — so there is
          no "is this mine" check here to get wrong.

          It is a banner rather than a redirect because the point is to
          show them the campaign they wrote, unchanged, with its status
          attached. A submission that bounces to a list looks like it
          was thrown away.
        */}
        {campaign.status === "PENDING" && (
          <div className="mb-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-brand-tint)] px-4 py-3">
            <p className="text-[13.5px] font-semibold">{t("heroes.waitingReview", "Waiting for review")}</p>
            <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
              {t(
                "campaignDetail.pendingBlurb",
                "Only you can see this page. A moderator reads it — photos included — before it goes live, usually within a day.",
              )}
            </p>
          </div>
        )}

        {campaign.status === "REJECTED" && (
          <div className="mb-3 rounded-2xl border border-[color:var(--color-danger)]/40 bg-[color:var(--color-surface)] px-4 py-3">
            <p className="text-[13.5px] font-semibold">{t("campaignDetail.rejected", "This wasn't approved")}</p>
            <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
              {campaign.reviewNote
                ? campaign.reviewNote
                : t("campaignDetail.rejectedBlurb", "It didn't meet our community guidelines.")}
            </p>
          </div>
        )}

        {/* ── header ───────────────────────────────────────── */}
        <header className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
          {campaign.coverUrl && (
            <div className="aspect-[21/7] w-full overflow-hidden bg-[color:var(--color-surface-muted)]">
              <Img src={campaign.coverUrl} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <div className="p-4 sm:p-5">
            {campaign.finished && (
              <p className="mb-2 inline-block rounded-full bg-[color:var(--color-surface-muted)] px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
                {t("campaignDetail.finished", "Finished")}
              </p>
            )}
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] sm:text-[30px]">
              {campaign.emoji ? `${campaign.emoji} ` : ""}
              <TranslatedContent kind="campaign" id={campaign.id} field="title" text={campaign.title} toggle={false} />
            </h1>
            {campaign.summary && (
              <p className="mt-2 max-w-[62ch] text-[16px] leading-relaxed text-[color:var(--color-text-muted)]">
                <TranslatedContent kind="campaign" id={campaign.id} field="summary" text={campaign.summary} toggle={false} />
              </p>
            )}

            <p className="mt-3 text-[12.5px] tabular-nums text-[color:var(--color-text-subtle)]">
              {campaign.supporterCount === 1
                ? t("campaigns.oneSupporter", "1 supporter")
                : t("campaigns.nSupporters", "{n} supporters", { n: campaign.supporterCount })}
              {dateRange ? ` · ${dateRange}` : ""}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void toggleSupport()}
                aria-pressed={campaign.supporting}
                disabled={campaign.finished && !campaign.supporting}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[14px] font-medium transition-colors duration-200 active:scale-[0.98] disabled:opacity-50 ${
                  campaign.supporting
                    ? "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)]"
                    : "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
                }`}
              >
                {campaign.supporting
                  ? t("campaignDetail.supporting", "You're behind this ✓")
                  : t("campaignDetail.support", "I support this")}
              </button>

              {campaign.ctaUrl && campaign.callToAction && (
                <a
                  href={campaign.ctaUrl}
                  {...(campaign.ctaUrl.startsWith("http")
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="inline-flex min-h-11 items-center rounded-full border border-[color:var(--color-brand)] px-4 text-[14px] font-medium text-[color:var(--color-brand)] hover:bg-[color:var(--color-brand)]/5"
                >
                  {campaign.callToAction}
                </a>
              )}

              {/*
                DONATIONS SIT WITH THE OTHER WAYS TO BACK THIS — beside
                "I support this" and the campaign's own call to action,
                not in a separate box further down. Somebody who has
                just read the case is deciding here.

                ONLY ON A PUBLISHED CAMPAIGN. A draft, a pending one,
                or a rejected one is shown to its author with its
                status on it; taking money towards something that is
                not live yet, and may never be, is the outcome to
                avoid — the same rule the event page follows for a
                cancelled or finished event. The server enforces it
                too, and would refuse: this only keeps the button off
                a page where pressing it could not work.

                The button hides itself when Stripe is not connected.
              */}
              {campaign.status === "PUBLISHED" && (
                <DonateButton
                  campaignId={campaign.id}
                  causeLabel={campaign.title}
                  signedIn={!!viewer}
                />
              )}

              <button
                type="button"
                onClick={() => void share()}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[color:var(--color-border)] px-4 text-[14px] font-medium text-[color:var(--color-text-muted)] hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-text)]"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M7 10.5l6-3.5M7 9.5l6 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="15" cy="5.5" r="2.2" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="5" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="15" cy="14.5" r="2.2" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                {copied ? t("campaignDetail.copied", "Link copied") : t("common.share", "Share")}
              </button>
            </div>
          </div>
        </header>

        {/* ── the case ─────────────────────────────────────── */}
        {campaign.body?.trim() && (
          <section className="mt-6">
            <div className="max-w-[68ch]">
              <TranslatedMarkdown kind="campaign" id={campaign.id} text={campaign.body} />
            </div>
          </section>
        )}

        {/*
          ── the gallery ───────────────────────────────────────
          After the case, not before it. A campaign is an argument;
          the photographs are evidence for it, and evidence that
          arrives ahead of the claim is just decoration.

          The same PhotoGallery the events page uses — grid, keyboard
          lightbox, escape to close — rather than a second grid of
          links that drop the reader on a raw image URL.
        */}
        {campaign.photos.length > 0 && (
          <section className="mt-6">
            <PhotoGallery photos={campaign.photos} />
          </section>
        )}

        {/* ── what's attached ──────────────────────────────── */}
        {campaign.articles.length > 0 && (
          <section className="mt-8">
            <SectionTitle>{t("campaignDetail.readUp", "Read up")}</SectionTitle>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {campaign.articles.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/articles/${a.slug}`}
                    className="group flex gap-3 overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-3 shadow-card transition-shadow duration-200 hover:shadow-elevated"
                  >
                    <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-[color:var(--color-surface-muted)]">
                      {a.coverUrl ? (
                        <Img src={a.coverUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[18px]">📄</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {a.category && (
                        <p className="text-[11.5px] font-medium text-[color:var(--color-brand)]">
                          {a.category.name}
                        </p>
                      )}
                      <p className="mt-0.5 line-clamp-2 text-[14.5px] font-semibold leading-snug tracking-[-0.01em]">
                        <TranslatedContent kind="article" id={a.id} field="title" text={a.title} toggle={false} />
                      </p>
                      <p className="mt-1 text-[11.5px] text-[color:var(--color-text-subtle)]">
                        {a.readMinutes} min read
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {campaign.events.length > 0 && (
          <section className="mt-8">
            <SectionTitle>{t("campaignDetail.turnUp", "Turn up")}</SectionTitle>
            <ul className="divide-y divide-[color:var(--color-border-soft)] overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
              {campaign.events.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/events/${e.slug}`}
                    className="group flex gap-3 p-3 transition-colors duration-200 hover:bg-[color:var(--color-surface-muted)] sm:gap-4 sm:p-4"
                  >
                    <div className="w-11 shrink-0 text-center">
                      <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--color-brand)]">
                        {e.monthLabel}
                      </span>
                      <span className="block text-[20px] font-semibold leading-tight tabular-nums">
                        {e.dayLabel}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-[color:var(--color-text-muted)]">
                        {e.timeLabel} · {e.placeLabel}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[15px] font-semibold tracking-[-0.01em]">
                        <TranslatedContent kind="event" id={e.id} field="title" text={e.title} toggle={false} />
                      </p>
                      <p className="mt-0.5 text-[11.5px] tabular-nums text-[color:var(--color-text-subtle)]">
                        {e.rsvpCount} going
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Above the chatroom on purpose: the petition is the ask, and
            the ask should come before the conversation about it. */}
        {campaign.petition && (
          <section className="mt-8">
            <SectionTitle>{t("campaignDetail.addName", "Add your name")}</SectionTitle>
            <Link
              href={`/petitions/${campaign.petition.slug}`}
              className="block rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-4 shadow-card transition-shadow duration-200 hover:shadow-elevated"
            >
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
                To {campaign.petition.target}
              </p>
              <p className="mt-0.5 text-[15px] font-semibold tracking-[-0.01em]">
                {campaign.petition.title}
              </p>
              <p className="mt-1.5 text-[12.5px] text-[color:var(--color-text-muted)]">
                <span className="font-semibold tabular-nums text-[color:var(--color-text)]">
                  {campaign.petition.signatureCount.toLocaleString()}
                </span>{" "}
                {campaign.petition.signatureCount === 1
                  ? t("petitions.signature", "signature")
                  : t("petitions.signatures", "signatures")}
                {campaign.petition.goal
                  ? ` of ${campaign.petition.goal.toLocaleString()}`
                  : ""}
              </p>
            </Link>
          </section>
        )}

        {campaign.room && (
          <section className="mt-8">
            <SectionTitle>{t("campaignDetail.talk", "Talk it through")}</SectionTitle>
            <Link
              href={`/chatrooms/${campaign.room.slug}`}
              className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-4 shadow-card transition-shadow duration-200 hover:shadow-elevated"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand)]/10 text-[color:var(--color-brand)]">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M4 5.5A1.5 1.5 0 015.5 4h9A1.5 1.5 0 0116 5.5v6A1.5 1.5 0 0114.5 13H8l-3 3v-3H5.5A1.5 1.5 0 014 11.5v-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold tracking-[-0.01em]">{campaign.room.name}</p>
                {campaign.room.description && (
                  <p className="line-clamp-1 text-[13px] text-[color:var(--color-text-muted)]">
                    {campaign.room.description}
                  </p>
                )}
                <p className="mt-0.5 text-[11.5px] tabular-nums text-[color:var(--color-text-subtle)]">
                  {campaign.room.memberCount === 1
                    ? t("chat.oneMember", "1 member")
                    : t("chat.nMembers", "{n} members", { n: campaign.room.memberCount })}
                </p>
              </div>
            </Link>
          </section>
        )}

        {!hasParts && !campaign.body?.trim() && (
          <p className="mt-8 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-8 text-center text-[13.5px] text-[color:var(--color-text-muted)] shadow-card">
            {t("campaignDetail.nothingAttached", "Nothing has been attached to this campaign yet.")}
          </p>
        )}
      </div>
    </SiteShell>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[17px] font-semibold tracking-[-0.01em]">{children}</h2>
  );
}
