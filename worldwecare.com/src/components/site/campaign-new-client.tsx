"use client";

/**
 * Submitting a campaign.
 *
 * THE FORM IS SHORTER THAN THE ADMIN ONE, and the missing fields are
 * the design rather than an oversight. There is no action link, no
 * date window, and nothing to attach an article, event, chatroom or
 * petition with. Those are the curation that makes a campaign an
 * aggregator rather than a post, and a public form is not where you
 * hand out the ability to staple your campaign to somebody else's
 * chatroom. `submitCampaign` in lib/campaigns.ts states the same list
 * and the reason for each; the two are meant to be read together.
 *
 * The one that most looks like an omission is the link. A campaign
 * page reads as endorsed by this place, and an outbound link is the
 * single thing a spam submission is actually after — so a moderator
 * adds it at review, having looked at where it goes.
 *
 * Nothing here is disabled while it is incomplete. The button says
 * what is missing when pressed; a greyed-out control that will not
 * explain itself is the worst version of this form. (Same rule as the
 * petition form and the signup form.)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { useCountry } from "./country-context";
import { PhotoDropzone, type DropzonePhoto } from "@/components/ui/photo-dropzone";
import type { PublicCampaignCategory } from "@/lib/campaign-categories";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";

export function CampaignNewClient({
  viewer,
  categories,
}: {
  viewer: ShellViewer;
  /**
   * Read on the server and passed down, not fetched here: a required
   * field whose options arrive a moment after the form does is one
   * somebody can reach the bottom of the page without having seen.
   */
  categories: PublicCampaignCategory[];
}) {
  const t = useT();
  const router = useRouter();
  const { countryId } = useCountry();

  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<DropzonePhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);

    const res = await fetch("/api/user/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        summary: summary || null,
        body,
        categoryId: categoryId || null,
        countryId: countryId ?? null,
        // First photo is the cover, the rest are the gallery — the
        // same split the petition and event forms use, so all three
        // behave the same way for anyone who has met one already.
        coverUrl: photos[0]?.url ?? null,
        photos: photos.slice(1),
      }),
    }).catch(() => null);

    setBusy(false);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(serverText(t, d?.error) || t("campaignNew.failed", "Couldn't submit that campaign."));
      return;
    }
    const d = (await res.json()) as { slug: string };
    // Straight to the campaign's own page, which shows the "waiting for
    // review" state to the person who sent it in. Bouncing back to the
    // index would make a submission look like it vanished.
    router.push(`/campaigns/${d.slug}`);
  };

  return (
    <SiteShell viewer={viewer}>
      <Link
        href="/campaigns"
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)]"
      >
        ← All campaigns
      </Link>

      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
        <div className="border-b border-[color:var(--color-border-soft)] px-5 py-4">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">{t("campaigns.start", "Start a campaign")}</h1>
          <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
            {t(
              "campaigns.newBlurb",
              "A moderator reads it \u2014 photos included \u2014 before it goes live. That usually takes a day or so.",
            )}
          </p>
        </div>

        <div className="space-y-4 p-5">
          {/*
            REQUIRED, and first. The category is how the whole section
            is browsed — an uncategorised campaign exists and nobody
            arrives at it — so it is asked for before anything optional.

            A <select>, not a tile picker: this is one choice from a
            closed list, and the tiles are for browsing, not for filing.
          */}
          <Field
            label={t("campaignNew.categoryLabel", "What is this campaign about?")}
            hint={t("campaignNew.categoryHint", "Pick the area it belongs to. People browse campaigns by these.")}
          >
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputClass}
            >
              <option value="">{t("common.chooseOne", "Choose one\u2026")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji ? `${c.emoji} ` : ""}
                  {c.name}
                </option>
              ))}
            </select>
            {categories.length === 0 && (
              <span className="mt-1.5 block text-[12px] text-[color:var(--color-danger)]">
                {t(
                  "campaigns.noCategories",
                  "No categories have been set up yet, so campaigns can\u2019t be started. An admin needs to add some first.",
                )}
              </span>
            )}
          </Field>

          <Field
            label={t("campaignNew.titleLabel", "What are you calling it?")}
            hint={t("campaignNew.titleHint", "One line. This is the headline.")}
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder={t("campaignNew.titlePlaceholder", "Warm rooms for the winter")}
              className={inputClass}
            />
          </Field>

          <Field
            label={t("common.shortSummary", "Short summary")}
            hint={t("campaignNew.summaryHint", "Optional. Shown on the campaigns list.")}
          >
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={400}
              className={inputClass}
            />
          </Field>

          <Field
            label={t("campaignNew.bodyLabel", "What's it for?")}
            hint={t(
              "campaignNew.bodyHint",
              "What's happening, who it affects, and what you want to happen. Markdown works.",
            )}
          >
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder={t(
                "campaignNew.bodyPlaceholder",
                "Half the libraries near us closed their evening hours this year…",
              )}
              className={`${inputClass} resize-y leading-relaxed`}
            />
          </Field>

          <Field
            label={t("common.photos", "Photos")}
            hint={t(
              "campaignNew.photosHint",
              "Optional, up to six. The first becomes the card people see on the campaigns list; the rest sit with the case. A photo of the place or the people does more than a logo.",
            )}
          >
            <PhotoDropzone
              value={photos}
              onChange={setPhotos}
              endpoint="/api/user/upload"
              max={6}
              coverBadge
              disabled={busy}
            />
          </Field>

          {error && (
            <p className="text-[13px] text-[color:var(--color-danger)]" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="inline-flex h-11 items-center rounded-full bg-[color:var(--color-brand)] px-6 text-[14px] font-semibold text-[color:var(--color-on-brand)] transition-colors hover:bg-[color:var(--color-brand-hover)] disabled:opacity-60"
            >
              {busy ? t("common.submitting", "Submitting…") : t("common.submitForReview", "Submit for review")}
            </button>
            <Link
              href="/campaigns"
              className="text-[13.5px] text-[color:var(--color-text-muted)] hover:underline"
            >
              {t("common.cancel", "Cancel")}
            </Link>
          </div>

          <p className="text-[12px] leading-relaxed text-[color:var(--color-text-subtle)]">
            {t(
              "campaignNew.note",
              "If it's approved, a moderator may add a link, dates, or a chatroom to go with it. Campaigns naming a specific person or business are held to a higher bar.",
            )}
          </p>
        </div>
      </div>
    </SiteShell>
  );
}

const inputClass =
  "w-full rounded-xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] px-3.5 py-2.5 text-[14px] outline-none focus-visible:border-[color:var(--color-brand)]";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13.5px] font-medium">{label}</span>
      {hint && (
        <span className="mb-1.5 block text-[12px] text-[color:var(--color-text-subtle)]">
          {hint}
        </span>
      )}
      {children}
    </label>
  );
}
