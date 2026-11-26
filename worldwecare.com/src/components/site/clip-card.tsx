"use client";

/**
 * A clip tile in a theme grid.
 *
 * Deliberately does NOT mount an iframe or a <video>: a grid of 24
 * clips would be 24 third-party players, which is slow, leaks a
 * request to each provider before anyone asks to watch, and on mobile
 * is enough to stall the page. The tile is a still image plus a play
 * affordance; the real player only exists on the clip's own page.
 *
 * The thumbnail and the title are one <Link>, not two buttons that
 * called an onOpen handler. That is the whole point of the tile now:
 * middle-click opens a tab, cmd-click opens a background tab, hover
 * shows the destination, and the browser prefetches it. A button did
 * none of that.
 */

import { ReactionButton } from "./reaction-button";
import type { ReactionType } from "@/lib/reactions";
import Link from "next/link";
import { toEmbed } from "@/lib/embeds";
import { clipHref, type ClipView } from "@/lib/clip-view";
import { Img } from "@/components/ui/img";
import { useT } from "./locale-context";
import { TranslatedContent } from "./translated-content";
import { durationBadge } from "@/lib/duration";

export function ClipCard({
  clip,
  onToggleLike,
  onToggleSave,
  showTheme,
}: {
  clip: ClipView;
  onToggleLike: (type: ReactionType) => void;
  onToggleSave: () => void;
  showTheme?: boolean;
}) {
  const t = useT();
  const href = clipHref(clip);
  const embed = clip.kind === "EMBED" ? toEmbed(clip.embedUrl) : null;
  const poster = clip.kind === "UPLOAD" ? clip.posterUrl : (clip.posterUrl ?? embed?.thumbnail ?? null);
  const duration = durationBadge(clip.durationSec);
  const provider = embed?.provider ?? null;

  const iconBtn =
    "inline-flex items-center gap-1 rounded-full px-1.5 py-1 text-[12px] tabular-nums transition-colors duration-200";

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card transition-shadow duration-200 hover:shadow-elevated">
      <Link
        href={href ?? "#"}
        aria-label={t("clips.play", "Play {title}", { title: clip.title })}
        aria-disabled={href ? undefined : true}
        tabIndex={href ? undefined : -1}
        className="relative block aspect-video w-full overflow-hidden bg-[color:var(--color-surface-muted)]"
      >
        {poster ? (
          <Img
            src={poster}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[color:var(--color-brand-soft)] to-[color:var(--color-surface-muted)] text-[28px]">
            🎬
          </span>
        )}

        <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors duration-200 group-hover:bg-black/25">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-transform duration-200 group-hover:scale-105">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13l11-6.5-11-6.5z" />
            </svg>
          </span>
        </span>

        {(duration || provider) && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {duration ?? provider}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3">
        {showTheme && clip.theme && (
          <p className="mb-1 text-[11.5px] font-medium text-[color:var(--color-brand)]">
            {clip.theme.emoji ? `${clip.theme.emoji} ` : ""}
            {clip.theme.name}
          </p>
        )}

        <Link
          href={href ?? "#"}
          aria-disabled={href ? undefined : true}
          className="text-[14.5px] font-semibold leading-snug tracking-[-0.01em] line-clamp-2 hover:text-[color:var(--color-brand)]"
        >
          <TranslatedContent kind="clip" id={clip.id} field="title" text={clip.title} toggle={false} />
        </Link>

        <div className="mt-auto flex items-center gap-1 pt-2">
          <ReactionButton mine={clip.myReaction} count={clip.likeCount} onPick={onToggleLike} />

          {/* A link now, not an inert badge. The thread used to live
              inside a dialog, so there was nowhere for this to point;
              it has an address of its own since the clip became a
              page. */}
          {clip.commentCount > 0 && (
            <Link
              href={href ? `${href}#comments` : "#"}
              aria-disabled={href ? undefined : true}
              className={`${iconBtn} text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-brand)]`}
              aria-label={
                clip.commentCount === 1
                  ? t("comments.one", "1 comment")
                  : t("comments.n", "{n} comments", { n: clip.commentCount })
              }
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v7a2.5 2.5 0 01-2.5 2.5H9l-5 4v-4H6.5A2.5 2.5 0 014 13.5v-7z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
              {clip.commentCount}
            </Link>
          )}

          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={clip.saved}
            aria-label={clip.saved ? t("clips.unsave", "Remove from saved") : t("common.save", "Save")}
            className={`${iconBtn} ${
              clip.saved
                ? "text-[color:var(--color-brand)]"
                : "text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-brand)]"
            }`}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill={clip.saved ? "currentColor" : "none"} aria-hidden>
              <path
                d="M6.5 4.5h11v15l-5.5-3.6-5.5 3.6v-15z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}
