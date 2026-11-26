"use client";

/**
 * One petition: the ask, the count, the signatures, and the button.
 *
 * THE SIGN BUTTON IS THE PAGE. Everything else is context for a single
 * decision, so it stays visible while you read rather than sitting at
 * the bottom of the argument — someone persuaded three paragraphs in
 * should not have to go looking.
 */

import { ReactionButton } from "./reaction-button";
import type { ReactionType } from "@/lib/reactions";
import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Markdown } from "@/lib/rich-text";
import { Img } from "@/components/ui/img";
import { SiteShell, type ShellViewer } from "./site-shell";
import { SignatureBar } from "./petition-card";
import { VideoPlayer } from "@/components/ui/video-player";
import { PhotoGallery } from "./photo-gallery";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";
import { TranslatedContent } from "./translated-content";
import { TranslatedMarkdown } from "./translated-markdown";

export interface PetitionDetail {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string;
  coverUrl: string | null;
  photos: { url: string; alt: string | null }[];
  video: {
    url: string;
    posterUrl: string | null;
    width: number | null;
    height: number | null;
  } | null;
  target: string;
  goal: number | null;
  /** Null only for petitions that predate categories. */
  category: { id: string; name: string; slug: string; emoji: string | null; color: string | null } | null;
  signatureCount: number;
  closesAt: string | null;
  createdAt: string;
  creatorUserId: string | null;
  creatorName: string;
  creatorAvatar: string | null;
  status: string;
  open: boolean;
  isMine: boolean;
  hasSigned: boolean;
  reactionCount: number;
  myReaction: ReactionType | null;
  rejectionReason: string | null;
}

export interface SignatureDTO {
  userId: string;
  name: string;
  avatar: string | null;
  comment: string | null;
  createdAt: string;
}

export function PetitionDetailClient({
  viewer,
  initial,
  initialSignatures,
}: {
  viewer: ShellViewer;
  initial: PetitionDetail;
  initialSignatures: SignatureDTO[];
}) {
  const t = useT();
  const router = useRouter();
  const [petition, setPetition] = useState(initial);
  /*
   * The stored shape is `alt: string | null`; GalleryImage's `alt` is
   * optional, and `null` is not assignable to it. One conversion here
   * rather than a cast at the call site.
   */
  const photos = useMemo(
    () =>
      petition.photos.map((p) => (p.alt ? { url: p.url, alt: p.alt } : { url: p.url })),
    [petition.photos],
  );
  const [signatures, setSignatures] = useState(initialSignatures);
  const [comment, setComment] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Reactions are their own endpoint and their own counter. */
  const react = async (type: ReactionType) => {
    if (!viewer) return;
    const before = petition;
    const removing = petition.myReaction === type;
    setPetition((p) => ({
      ...p,
      myReaction: removing ? null : type,
      reactionCount: removing
        ? Math.max(0, p.reactionCount - 1)
        : p.myReaction
          ? p.reactionCount
          : p.reactionCount + 1,
    }));
    try {
      const res = await fetch(`/api/user/petitions/${petition.slug}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error();
      const d = (await res.json()) as { reactionCount: number; myReaction: ReactionType | null };
      setPetition((p) => ({ ...p, reactionCount: d.reactionCount, myReaction: d.myReaction }));
    } catch {
      setPetition(before);
    }
  };

  const sign = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/user/petitions/${petition.slug}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: comment.trim() || null, anonymous }),
    }).catch(() => null);
    setBusy(false);

    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(serverText(t, d?.error) || t("petitionDetail.signFailed", "Couldn't record that. Try again."));
      return;
    }

    const d = (await res.json()) as { signed: boolean; signatureCount: number };
    setPetition((p) => ({ ...p, hasSigned: d.signed, signatureCount: d.signatureCount }));
    setComment("");
    // The signer list is server-rendered; refresh rather than splicing
    // a row in by hand, so the order and the anonymity filter stay the
    // server's decision.
    router.refresh();
    const res2 = await fetch(`/api/user/petitions/${petition.slug}`, { cache: "no-store" }).catch(
      () => null,
    );
    if (res2?.ok) {
      const dd = (await res2.json()) as { signatures: SignatureDTO[] };
      setSignatures(dd.signatures ?? []);
    }
  };

  const close = async () => {
    if (
      !window.confirm(
        t(
          "petitionDetail.closeConfirm",
          "Close this petition? It stops taking signatures. This can't be undone.",
        ),
      )
    )
      return;
    setBusy(true);
    await fetch(`/api/user/petitions/${petition.slug}`, { method: "DELETE" }).catch(() => undefined);
    setBusy(false);
    router.refresh();
  };

  return (
    <SiteShell viewer={viewer}>
      <Link
        href="/petitions"
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)]"
      >
        ← {t("petitionDetail.all", "All petitions")}
      </Link>

      {petition.status === "PENDING" && (
        <p className="mb-3 rounded-xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] px-4 py-3 text-[13px]">
          {t(
            "petitionDetail.pending",
            "This is waiting for review. Only you can see it until it's approved.",
          )}
        </p>
      )}
      {petition.status === "REJECTED" && (
        <p className="mb-3 rounded-xl border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/10 px-4 py-3 text-[13px]">
          {t("campaignDetail.rejected", "This wasn't approved")}
          {petition.rejectionReason
            ? " " + t("petitionDetail.reason", "Reason: {reason}", { reason: petition.rejectionReason })
            : ""}
        </p>
      )}

      <article className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
        {petition.coverUrl && (
          <div className="aspect-[16/7] w-full overflow-hidden bg-[color:var(--color-surface-muted)]">
            <Img src={petition.coverUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}

        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
              To {petition.target}
            </p>
            {/*
              A LINK here, unlike on the list card, where the whole row
              is already an anchor. Somebody who has just read one
              petition about housing is the reader most likely to want
              the rest of them.
            */}
            {petition.category && (
              <Link
                href={`/petitions/category/${petition.category.slug}`}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-brand)]"
                style={{
                  backgroundColor: petition.category.color
                    ? `${petition.category.color}1f`
                    : "var(--color-surface-muted)",
                }}
              >
                {petition.category.emoji && <span aria-hidden>{petition.category.emoji}</span>}
                {petition.category.name}
              </Link>
            )}
          </div>
          <h1 className="mt-1 text-[24px] font-semibold leading-snug tracking-[-0.02em] sm:text-[28px]">
            <TranslatedContent kind="petition" id={petition.id} field="title" text={petition.title} toggle={false} />
          </h1>

          <p className="mt-2 text-[13px] text-[color:var(--color-text-muted)]">
            Started by{" "}
            {petition.creatorUserId ? (
              <Link href={`/u/${petition.creatorUserId}`} className="font-medium hover:underline">
                {petition.creatorName}
              </Link>
            ) : (
              <span className="font-medium">{petition.creatorName}</span>
            )}
            {petition.closesAt && petition.open && (
              <> · closes {new Date(petition.closesAt).toLocaleDateString()}</>
            )}
          </p>

          <div className="my-5 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] p-4">
            <SignatureBar count={petition.signatureCount} goal={petition.goal} />

            {!petition.open ? (
              <p className="mt-3 text-[13px] text-[color:var(--color-text-muted)]">
                {t(
                  "petitionDetail.closed",
                  "This petition has closed. The count stands as a record of who backed it.",
                )}
              </p>
            ) : petition.hasSigned ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-[13.5px] font-medium text-[color:var(--color-brand)]">
                  {t("petitionDetail.signed", "You've signed this.")}
                </span>
                <button
                  type="button"
                  onClick={() => void sign()}
                  disabled={busy}
                  className="text-[13px] text-[color:var(--color-text-muted)] underline hover:text-[color:var(--color-danger)] disabled:opacity-50"
                >
                  {t("petitionDetail.withdraw", "Withdraw my signature")}
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-2.5">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  maxLength={400}
                  placeholder={t("petitionDetail.commentPlaceholder", "Why does this matter to you? (optional)")}
                  className="w-full resize-none rounded-xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] px-3 py-2 text-[13.5px] outline-none focus-visible:border-[color:var(--color-brand)]"
                />
                <label className="flex items-center gap-2 text-[13px] text-[color:var(--color-text-muted)]">
                  <input
                    type="checkbox"
                    checked={anonymous}
                    onChange={(e) => setAnonymous(e.target.checked)}
                    className="h-4 w-4 accent-[color:var(--color-brand)]"
                  />
                  {/* Someone signing about addiction services or family
                      abuse may need the count without the exposure. */}
                  {t("petitionDetail.anon", "Count me, but don't show my name")}
                </label>
                <button
                  type="button"
                  onClick={() => void sign()}
                  disabled={busy}
                  className="inline-flex h-11 items-center rounded-full bg-[color:var(--color-brand)] px-6 text-[14px] font-semibold text-[color:var(--color-on-brand)] transition-colors hover:bg-[color:var(--color-brand-hover)] disabled:opacity-60"
                >
                  {busy ? t("petitionDetail.signing", "Signing…") : t("petitionDetail.sign", "Sign this petition")}
                </button>
              </div>
            )}

            {error && (
              <p className="mt-2 text-[12.5px] text-[color:var(--color-danger)]" role="status">
                {error}
              </p>
            )}

            {/*
              BELOW THE ASK, ALWAYS, AND VISUALLY QUIETER.
              A petition's whole point is the signature. Put a one-tap
              reaction beside "Sign this petition" and some people take
              the cheaper action and feel they have participated — the
              petition ends up with fewer names than it would have had
              without the button. Here it sits under a divider, after
              the sign flow has had its say, as a way to respond to a
              petition you are not going to sign rather than a way to
              avoid signing one you would have.

              It also stays available on a CLOSED petition, where there
              is no longer anything to compete with.
            */}
            <div className="mt-4 flex items-center gap-2 border-t border-[color:var(--color-border-soft)] pt-3">
              <ReactionButton
                mine={petition.myReaction}
                count={petition.reactionCount}
                onPick={react}
                disabled={!viewer}
              />
              <span className="text-[11.5px] text-[color:var(--color-text-subtle)]">
                {t(
                  "petitionDetail.reactionsNote",
                  "Reactions aren\u2019t signatures \u2014 they\u2019re counted separately.",
                )}
              </span>
            </div>
          </div>

          <div className="prose-wwc max-w-[70ch]">
            <TranslatedMarkdown kind="petition" id={petition.id} text={petition.body} />
          </div>

          {/* Media sits AFTER the case, not before it. A petition
              persuades in prose; the pictures are evidence for an
              argument someone has already started reading. Putting
              them above pushes the ask below the fold. */}
          {petition.video && (
            <div className="mt-6 max-w-[70ch]">
              <VideoPlayer
                src={petition.video.url}
                poster={petition.video.posterUrl}
                width={petition.video.width}
                height={petition.video.height}
              />
            </div>
          )}

          {/*
            THE SHARED GALLERY, not a grid of links.

            These were `target="_blank"` anchors, which dumped the
            reader on a raw image URL with no way back — the exact
            thing PhotoGallery was written to fix for events. A
            petition's photos are its evidence; making them a dead end
            was the worst place on the site to have one.
          */}
          {photos.length > 0 && (
            <div className="mt-6 max-w-[70ch]">
              <PhotoGallery photos={photos} />
            </div>
          )}

          {petition.isMine && petition.open && (
            <button
              type="button"
              onClick={() => void close()}
              disabled={busy}
              className="mt-6 text-[13px] text-[color:var(--color-text-muted)] underline hover:text-[color:var(--color-danger)]"
            >
              {t("petitionDetail.close", "Close this petition")}
            </button>
          )}
        </div>
      </article>

      <section className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
        <h2 className="border-b border-[color:var(--color-border-soft)] px-5 py-3.5 text-[14px] font-semibold">
          {t("petitionDetail.whoSigned", "Who\u2019s signed")}
        </h2>
        {signatures.length === 0 ? (
          <p className="px-5 py-6 text-[13.5px] text-[color:var(--color-text-muted)]">
            {petition.signatureCount > 0
              ? "Everyone who has signed so far chose not to show their name."
              : "Nobody yet. Be first."}
          </p>
        ) : (
          <ul className="divide-y divide-[color:var(--color-border-soft)]">
            {signatures.map((s) => (
              <li key={s.userId} className="flex gap-3 px-5 py-3">
                <Avatar name={s.name} url={s.avatar} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/u/${s.userId}`}
                    className="text-[13.5px] font-medium hover:underline"
                  >
                    {s.name}
                  </Link>
                  {s.comment && (
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-snug text-[color:var(--color-text-muted)]">
                      {s.comment}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {/* The named list is capped; the count is not. Saying so stops
            it reading as a miscount. */}
        {petition.signatureCount > signatures.length && (
          <p className="border-t border-[color:var(--color-border-soft)] px-5 py-3 text-[12.5px] text-[color:var(--color-text-subtle)]">
            Showing {signatures.length} of {petition.signatureCount.toLocaleString()} — the rest
            signed without showing their name, or are further down the list.
          </p>
        )}
      </section>
    </SiteShell>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <Img src={url} alt="" variant="thumb" className="h-8 w-8 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-soft)] text-[12px] font-semibold text-[color:var(--color-brand-ink)]">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
