"use client";

/**
 * A clip on its own page.
 *
 * This replaced a modal. The dialog worked, but it made the clip
 * unaddressable: nothing to send someone, nothing to open in a new
 * tab, no back button, and a comment thread that lived inside an
 * overlay squeezed between the video and the bottom of the viewport.
 * A page fixes all four at once.
 *
 * What carried over from the dialog, because it was right there:
 *   • the player only exists on this screen — a grid never mounts one
 *   • an EMBED src is only ever built by `toEmbed`, so a link that is
 *     not on the whitelist renders as a link and never as a frame
 *   • ← and → still move between clips in the theme
 *
 * What changed: the arrows are real links, so they prefetch, and they
 * stop at the ends of the theme instead of wrapping. Looping is right
 * inside a dialog you opened to browse; on a page with history it
 * hides the fact that you reached the end.
 */

import { applyClipReaction } from "./clip-react";
import type { ReactionType } from "@/lib/reactions";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteShell, type ShellViewer } from "./site-shell";
import { ClipCard } from "./clip-card";
import { ClipComments } from "./threaded-comments";
import { VideoPlayer } from "@/components/ui/video-player";
import { Markdown } from "@/lib/rich-text";
import { toEmbed } from "@/lib/embeds";
import type { ClipView } from "@/lib/clip-view";
import { useT } from "./locale-context";
import { TranslatedContent } from "./translated-content";
import { TranslatedMarkdown } from "./translated-markdown";

interface Neighbour {
  id: string;
  title: string;
  posterUrl: string | null;
}

export function ClipDetailClient({
  viewer,
  theme,
  clip: initial,
  prev,
  next,
  position,
  total,
  more: initialMore,
}: {
  viewer: ShellViewer;
  theme: { slug: string; name: string; emoji: string | null; tagline: string | null };
  clip: ClipView;
  prev: Neighbour | null;
  next: Neighbour | null;
  position: number;
  total: number;
  more: ClipView[];
}) {
  const t = useT();
  const router = useRouter();
  const [clip, setClip] = useState(initial);
  const [more, setMore] = useState(initialMore);

  // A page is remounted per clip by the router, but the arrows are
  // client navigations within the same route — so the server props
  // change under a component that is not remounted. Without this the
  // reader would arrive at the next clip and see the previous one's
  // like state.
  useEffect(() => setClip(initial), [initial]);
  useEffect(() => setMore(initialMore), [initialMore]);

  const prevHref = prev ? `/library/${theme.slug}/${prev.id}` : null;
  const nextHref = next ? `/library/${theme.slug}/${next.id}` : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The player keeps the arrow keys once it has focus — seeking is
      // the more likely intent when you are inside the video. Same for
      // anywhere text is being typed, including the comment box.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "VIDEO") return;
      if (e.key === "ArrowRight" && nextHref) router.push(nextHref);
      else if (e.key === "ArrowLeft" && prevHref) router.push(prevHref);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, prevHref, nextHref]);

  /**
   * Optimistic, then reconciled with the server's count. Reverting on
   * failure matters: a heart that stays filled after a failed write is
   * a lie the reader has no way to notice.
   */
  const toggle = async (kind: "like" | "save") => {
    const flip = (c: ClipView): ClipView =>
      kind === "like"
        ? { ...c, liked: !c.liked, likeCount: Math.max(0, c.likeCount + (c.liked ? -1 : 1)) }
        : { ...c, saved: !c.saved, saveCount: Math.max(0, c.saveCount + (c.saved ? -1 : 1)) };

    setClip(flip);
    const res = await fetch(`/api/user/clips/${clip.id}/${kind}`, { method: "POST" }).catch(
      () => null,
    );
    if (!res?.ok) {
      setClip(flip);
      return;
    }
    const d = (await res.json().catch(() => ({}))) as {
      liked?: boolean;
      saved?: boolean;
      likeCount?: number;
      saveCount?: number;
    };
    setClip((c) => ({
      ...c,
      ...(typeof d.liked === "boolean" ? { liked: d.liked } : {}),
      ...(typeof d.saved === "boolean" ? { saved: d.saved } : {}),
      ...(typeof d.likeCount === "number" ? { likeCount: d.likeCount } : {}),
      ...(typeof d.saveCount === "number" ? { saveCount: d.saveCount } : {}),
    }));
  };

  const toggleOnTile = async (id: string, kind: "like" | "save", type?: ReactionType) => {
    // Snapshot, not "apply the inverse". A reaction has three outcomes
    // and only two of them are their own inverse.
    const before = more;
    setMore((prevList) =>
      prevList.map((c) =>
        c.id !== id
          ? c
          : kind === "like"
            ? applyClipReaction(c, type ?? "LIKE")
            : { ...c, saved: !c.saved, saveCount: Math.max(0, c.saveCount + (c.saved ? -1 : 1)) },
      ),
    );
    const res = await fetch(`/api/user/clips/${id}/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kind === "like" ? { type: type ?? "LIKE" } : {}),
    }).catch(() => null);
    if (!res?.ok) setMore(before);
  };

  const embed = clip.kind === "EMBED" ? toEmbed(clip.embedUrl) : null;

  return (
    // The right rail goes: a video wants the width, and a page whose
    // whole job is one player should not be sharing it with a sidebar.
    <SiteShell viewer={viewer} hideRightRail>
      <nav className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <Link
          href="/library"
          className="font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)]"
        >
          {t("nav.library", "Library")}
        </Link>
        <span aria-hidden className="text-[color:var(--color-text-subtle)]">
          /
        </span>
        <Link
          href={`/library/${theme.slug}`}
          className="font-medium text-[color:var(--color-brand)] hover:underline"
        >
          {theme.emoji ? `${theme.emoji} ` : ""}
          <TranslatedContent kind="libraryTheme" id={theme.slug} field="name" text={theme.name} toggle={false} />
        </Link>
      </nav>

      <article className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
        {/* The media sits on black: once the frame is height-capped it
            is narrower than the column, and a video floating on the
            surface colour looks like a rendering fault. */}
        {clip.kind === "UPLOAD" && clip.videoUrl ? (
          <div className="bg-black">
            <VideoPlayer
              key={clip.id}
              src={clip.videoUrl}
              poster={clip.posterUrl}
              width={clip.width}
              height={clip.height}
              autoPlay
              maxHeight="70vh"
              className="rounded-none"
            />
          </div>
        ) : embed ? (
          <div className="bg-black">
            <div
              className="mx-auto w-full bg-black"
              style={
                embed.kind === "audio"
                  ? undefined
                  : { aspectRatio: "16 / 9", width: "min(100%, calc(70vh * (16 / 9)))" }
              }
            >
              <iframe
                key={clip.id}
                src={embed.src}
                title={clip.title || embed.title}
                height={embed.kind === "audio" ? embed.height : undefined}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
          </div>
        ) : (
          <div className="p-10 text-center">
            <p className="text-[14px] text-[color:var(--color-text-muted)]">
              {t("clip.cannotPlay", "This clip can\u2019t be played here.")}
            </p>
            {clip.embedUrl && (
              <a
                href={clip.embedUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-2 inline-block text-[13.5px] font-medium text-[color:var(--color-brand)] hover:underline"
              >
                {t("clip.openSource", "Open it where it lives")}
              </a>
            )}
          </div>
        )}

        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="min-w-0 text-[21px] font-semibold leading-snug tracking-[-0.02em] sm:text-[24px]">
              <TranslatedContent kind="clip" id={clip.id} field="title" text={clip.title} toggle={false} />
            </h1>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => void toggle("like")}
                aria-pressed={clip.liked}
                aria-label={clip.liked ? t("clip.unlike", "Unlike") : t("clip.like", "Like")}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 text-[13px] tabular-nums transition-colors duration-200 ${
                  clip.liked
                    ? "text-[color:var(--color-danger)]"
                    : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-danger)]"
                }`}
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill={clip.liked ? "currentColor" : "none"} aria-hidden>
                  <path d="M12 20s-7-4.4-7-9.3A4.2 4.2 0 0112 7.6a4.2 4.2 0 017 3.1c0 4.9-7 9.3-7 9.3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                </svg>
                {clip.likeCount > 0 && clip.likeCount}
              </button>
              <button
                type="button"
                onClick={() => void toggle("save")}
                aria-pressed={clip.saved}
                aria-label={clip.saved ? t("clip.unsave", "Remove from saved") : t("post.save", "Save")}
                className={`inline-flex items-center rounded-full px-2.5 py-2 transition-colors duration-200 ${
                  clip.saved
                    ? "text-[color:var(--color-brand)]"
                    : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)]"
                }`}
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill={clip.saved ? "currentColor" : "none"} aria-hidden>
                  <path d="M6.5 4.5h11v15l-5.5-3.6-5.5 3.6v-15z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          {clip.caption && (
            <div className="mt-3 max-w-[70ch] text-[14.5px]">
              <TranslatedMarkdown kind="clip" id={clip.id} field="caption" text={clip.caption} />
            </div>
          )}

          {total > 1 && (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[color:var(--color-border-soft)] pt-4">
              <NeighbourLink href={prevHref} clip={prev} direction="prev" />
              <span className="order-first w-full text-[12px] tabular-nums text-[color:var(--color-text-subtle)] sm:order-none sm:w-auto sm:flex-1 sm:text-center">
                {position} of {total} in {theme.name} · use ← and →
              </span>
              <NeighbourLink href={nextHref} clip={next} direction="next" />
            </div>
          )}

          <div className="mt-6">
            <ClipComments
              clipId={clip.id}
              viewer={viewer}
              signInHref={`/login?next=/library/${theme.slug}/${clip.id}`}
              onCountChange={(n) => setClip((c) => ({ ...c, commentCount: n }))}
            />
          </div>
        </div>
      </article>

      {more.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em]">
              Next up in {theme.name}
            </h2>
            <Link
              href={`/library/${theme.slug}`}
              className="text-[13px] font-medium text-[color:var(--color-brand)] hover:underline"
            >
              {t("common.seeAll", "See all")}
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((c) => (
              <ClipCard
                key={c.id}
                clip={c}
                onToggleLike={(t) => void toggleOnTile(c.id, "like", t)}
                onToggleSave={() => void toggleOnTile(c.id, "save")}
              />
            ))}
          </div>
        </section>
      )}
    </SiteShell>
  );
}

/**
 * One end of the prev/next pair.
 *
 * Renders as a disabled-looking span at the ends of the theme rather
 * than disappearing, so the two controls keep their positions and the
 * row doesn't reflow as you move through a theme.
 */
function NeighbourLink({
  href,
  clip,
  direction,
}: {
  href: string | null;
  clip: Neighbour | null;
  direction: "prev" | "next";
}) {
  const t = useT();
  const label = direction === "prev" ? t("common.previous", "Previous") : t("common.next", "Next");
  const arrow =
    direction === "prev" ? (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) : (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );

  const shell =
    "inline-flex max-w-[45%] items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] font-medium transition-colors duration-200";

  if (!href || !clip) {
    return (
      <span
        aria-disabled
        className={`${shell} border-[color:var(--color-border-soft)] text-[color:var(--color-text-subtle)] opacity-50`}
      >
        {direction === "prev" && arrow}
        {label}
        {direction === "next" && arrow}
      </span>
    );
  }

  return (
    <Link
      href={href}
      title={clip.title}
      className={`${shell} border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)]`}
    >
      {direction === "prev" && arrow}
      <span className="truncate">{label}</span>
      {direction === "next" && arrow}
    </Link>
  );
}
