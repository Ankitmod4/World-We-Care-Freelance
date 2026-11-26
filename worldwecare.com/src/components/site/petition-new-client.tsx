"use client";

/**
 * Starting a petition.
 *
 * THE FORM ASKS FOR THE ADDRESSEE FIRST. A petition with no "to whom"
 * is a complaint, and the difference between the two is the whole
 * reason one works — so the field that turns it into an ask is the
 * first thing on the page rather than an optional extra near the end.
 *
 * Nothing here is disabled while it is incomplete. The button says
 * what is missing when pressed; a greyed-out control that will not
 * explain itself is the worst version of this form. (Same rule as the
 * signup form — see app/login/user-auth-form.tsx.)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { useCountry } from "./country-context";
import { PhotoDropzone, type DropzonePhoto } from "@/components/ui/photo-dropzone";
import { VideoUpload, type UploadedVideo } from "@/components/ui/video-upload";
import type { PublicPetitionCategory } from "@/lib/petition-categories";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";

export function PetitionNewClient({
  viewer,
  categories,
}: {
  viewer: ShellViewer;
  /**
   * Read on the server and passed down, not fetched here: a required
   * field whose options arrive a moment after the form does is one
   * somebody can reach the bottom of the page without having seen.
   */
  categories: PublicPetitionCategory[];
}) {
  const t = useT();
  const router = useRouter();
  const { countryId } = useCountry();

  const [target, setTarget] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [goal, setGoal] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [photos, setPhotos] = useState<DropzonePhoto[]>([]);
  const [video, setVideo] = useState<UploadedVideo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);

    const res = await fetch("/api/user/petitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        summary: summary || null,
        body,
        target,
        goal: goal ? Number(goal) : null,
        closesAt: closesAt || null,
        countryId: countryId ?? null,
        categoryId: categoryId || null,
        // First photo is the cover, the rest are the gallery — the
        // same split the event submission uses, so the two forms
        // behave the same way for anyone who has met one already.
        coverUrl: photos[0]?.url ?? null,
        photos: photos.slice(1),
        // The ID, never the URL. The server resolves it against a
        // READY asset this member owns.
        videoAssetId: video?.id ?? null,
      }),
    }).catch(() => null);

    setBusy(false);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(serverText(t, d?.error) || t("petitionNew.failed", "Couldn't start that petition."));
      return;
    }
    const d = (await res.json()) as { slug: string };
    router.push(`/petitions/${d.slug}`);
  };

  return (
    <SiteShell viewer={viewer}>
      <Link
        href="/petitions"
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)]"
      >
        ← All petitions
      </Link>

      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
        <div className="border-b border-[color:var(--color-border-soft)] px-5 py-4">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">{t("petitions.start", "Start a petition")}</h1>
          <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
            {t(
              "petitions.newBlurb",
              "A moderator reads it \u2014 photos and video included \u2014 before it goes live. That usually takes a day or so.",
            )}
          </p>
        </div>

        <div className="space-y-4 p-5">
          <Field
            label={t("petitionNew.targetLabel", "Who is this addressed to?")}
            hint="A council, a company, a school board — whoever can actually say yes."
          >
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              maxLength={200}
              placeholder={t("petitionNew.targetPlaceholder", "Springfield City Council")}
              className={inputClass}
            />
          </Field>

          {/*
            REQUIRED, and second. The category is how the whole section
            is browsed — an uncategorised petition exists and nobody
            arrives at it — so it is asked for alongside the addressee
            rather than buried under the optional fields at the end.

            A <select>, not a tile picker: this is one choice from a
            closed list on a form that is already long, and the tiles
            are for browsing, not for filing.
          */}
          <Field
            label={t("petitionNew.categoryLabel", "What is this about?")}
            hint={t("petitionNew.categoryHint", "Pick the area it belongs to. People browse petitions by these.")}
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
                  "petitions.noCategories",
                  "No categories have been set up yet, so petitions can\u2019t be started. An admin needs to add some first.",
                )}
              </span>
            )}
          </Field>

          <Field
            label={t("petitionNew.titleLabel", "What are you asking for?")}
            hint={t("petitionNew.titleHint", "One sentence. This is the headline.")}
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder={t("petitionNew.titlePlaceholder", "Fund the three food banks on the north side")}
              className={inputClass}
            />
          </Field>

          <Field
            label={t("common.shortSummary", "Short summary")}
            hint={t("petitionNew.summaryHint", "Optional. Shown on the petitions list.")}
          >
            <input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={400}
              className={inputClass}
            />
          </Field>

          <Field
            label={t("petitionNew.bodyLabel", "The case")}
            hint={t(
              "petitionNew.bodyHint",
              "What's happening, who it affects, and what should change. Markdown works.",
            )}
          >
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder={t(
                "petitionNew.bodyPlaceholder",
                "Three food banks in our area have run out of supplies twice this year…",
              )}
              className={`${inputClass} resize-y leading-relaxed`}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("petitionNew.goalLabel", "Signature goal")}
              hint={t("petitionNew.goalHint", "Optional. Leave blank for no target.")}
            >
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                placeholder="500"
                className={inputClass}
              />
            </Field>

            <Field
              label={t("petitionNew.closesLabel", "Closes on")}
              hint={t("petitionNew.closesHint", "Optional. It stops taking signatures that day.")}
            >
              <input
                type="date"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field
            label={t("common.photos", "Photos")}
            /* Leads with the count. The old wording opened with "the
               first one becomes the card", which reads as a cover slot
               — one person took it to mean photos weren't supported at
               all. The control has always taken six; the label just
               didn't say so before the dropzone did. */
            hint={t(
              "petitionNew.photosHint",
              "Optional, up to six. The first becomes the card people see on the petitions list; the rest sit with the case. A photo of the place or the problem does more than a logo.",
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

          <Field
            label={t("composer.video", "Video")}
            hint={t(
              "common.videoHint",
              "Optional, one clip. Converted to MP4 with a thumbnail so it plays everywhere, including on iPhones.",
            )}
          >
            <VideoUpload value={video} onChange={setVideo} />
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
              href="/petitions"
              className="text-[13.5px] text-[color:var(--color-text-muted)] hover:underline"
            >
              {t("common.cancel", "Cancel")}
            </Link>
          </div>

          <p className="text-[12px] leading-relaxed text-[color:var(--color-text-subtle)]">
            {t(
              "petitionNew.note",
              "Petitions naming a specific person or business are held to a higher bar. Say what happened and what you want changed, not who you think someone is.",
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
