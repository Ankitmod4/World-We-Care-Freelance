"use client";

import { ReactionButton } from "./reaction-button";
import type { ReactionType } from "@/lib/reactions";
import { useMemo, useRef, useState, useEffect } from "react";
import { VideoPlayer } from "@/components/ui/video-player";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { RichText } from "@/lib/rich-text";
import { CommentThread } from "./comment-thread";
import { PostLightbox } from "./post-lightbox";
import { ConfirmDialog } from "./confirm-dialog";
import { Img } from "@/components/ui/img";
import { useT, useLocale } from "./locale-context";
import { countryLabel } from "@/lib/country-name";
import { timeAgo } from "@/lib/time-ago";
import { TranslationToggle, useTranslatedContent } from "./translated-content";

export interface FeedPost {
  id: string;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  body: string;
  images: Array<{ url: string; alt?: string | null }>;
  video: {
    assetId: string;
    url: string;
    posterUrl: string | null;
    width: number | null;
    height: number | null;
    durationSec: number | null;
  } | null;
  isAnonymous: boolean;
  isFeatured: boolean;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  liked: boolean;
  myReaction: ReactionType | null;
  saved: boolean;
  isOwn: boolean;
  countryName: string | null;
  countryCode: string | null;
  createdAt: string;
}

/**
 * A single card on the community wall. Renders the post + action
 * bar (like / comment / save) with a three-dot menu that offers
 * "Report" on others' posts and "Delete" on your own.
 *
 * When a `viewer` is provided, the comment button expands an inline
 * <CommentThread>. Without a viewer (e.g. signed-out preview) the
 * comment button is inert.
 *
 * Long posts collapse to ~10 lines with a "Read more" affordance so
 * one long story doesn't push the whole feed down.
 */
export function PostCard({
  post,
  viewer,
  defaultCommentsOpen = false,
  onReact,
  onToggleSave,
  onReport,
  onDelete,
  onBlock,
}: {
  post: FeedPost;
  viewer?: { id: string; displayName: string; avatarUrl: string | null };
  defaultCommentsOpen?: boolean;
  onReact: (type: ReactionType) => void;
  onToggleSave: () => void;
  onReport: () => void;
  onDelete?: () => void;
  onBlock?: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(defaultCommentsOpen);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /*
     The body is translated in place, so `isLong` and "Read more"
     measure what is actually on screen — a Russian rendering of an
     English post is routinely a third longer, and clamping on the
     English length would cut it in the wrong place.
  */
  const bodyT = useTranslatedContent("post", post.id, "body", post.body);
  const isLong = bodyT.text.length > 500 || bodyT.text.split("\n").length > 10;

  return (
    <article className="rounded-[16px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-4 sm:p-5">
      <header className="flex items-center gap-3">
        <Avatar
          name={post.isAnonymous ? "?" : post.authorName}
          url={post.isAnonymous ? null : post.authorAvatar}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {post.isAnonymous || !post.authorId ? (
              <p className="text-[14px] font-semibold tracking-[-0.01em] truncate">
                {post.isAnonymous ? t("post.anonymous", "Anonymous member") : post.authorName}
              </p>
            ) : (
              <Link href={`/u/${post.authorId}`} className="text-[14px] font-semibold tracking-[-0.01em] truncate hover:underline">
                {post.authorName}
              </Link>
            )}
            {post.isOwn && (
              <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold px-1.5 py-0.5 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)]">
                {t("post.you", "You")}
              </span>
            )}
            {post.isFeatured && (
              <span className="text-[10.5px] uppercase tracking-[0.08em] font-semibold px-1.5 py-0.5 rounded-full bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)]">
                {t("post.featured", "Featured")}
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-[color:var(--color-text-subtle)] mt-0.5">
            {/* Date.now()-based, so the server and the browser can land
                either side of a minute boundary. The client value is
                the correct one; tell React not to warn about the
                difference rather than freezing the clock. */}
            <span suppressHydrationWarning>{timeAgo(t, post.createdAt)}</span>
            {/*
              The name in the reader's language. `Intl` knows every
              country in every language, so this costs nothing and
              needs no translator — see `country-name.ts`.
            */}
            {post.countryName &&
              ` · ${countryLabel(locale, post.countryCode, post.countryName)}`}
          </p>
        </div>
        <PostMenu
          isOwn={post.isOwn}
          onReport={onReport}
          onDelete={onDelete ? () => setConfirmDelete(true) : undefined}
          onBlock={onBlock}
        />
      </header>

      {post.body && (
        <>
          <div className={cn("mt-3 relative", isLong && !expanded && "max-h-[16rem] overflow-hidden")}>
            <RichText text={bodyT.text} className="text-[14.5px] leading-relaxed break-words" />
            {isLong && !expanded && (
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[color:var(--color-surface)] to-transparent" />
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {isLong && !expanded && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-[13px] font-medium text-[color:var(--color-brand)] hover:underline"
              >
                {t("post.readMore", "Read more")}
              </button>
            )}
            <TranslationToggle state={bodyT} />
          </div>
        </>
      )}

      {post.video && (
        <div className="mt-3">
          <VideoPlayer
            src={post.video.url}
            poster={post.video.posterUrl}
            width={post.video.width}
            height={post.video.height}
          />
        </div>
      )}

      {post.images.length === 1 && (
        <button
          type="button"
          onClick={() => setLightbox(0)}
          className="mt-3 block w-full overflow-hidden rounded-[12px] bg-[color:var(--color-surface-muted)] cursor-zoom-in"
        >
          <Img
            src={post.images[0].url}
            alt={post.images[0].alt ?? ""}
            className="w-full max-h-[600px] object-contain"
          />
        </button>
      )}

      {post.images.length > 1 && (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-[12px] overflow-hidden">
          {post.images.slice(0, 4).map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLightbox(i)}
              className="relative block cursor-zoom-in"
            >
              <Img
                src={img.url}
                alt={img.alt ?? ""}
                variant="thumb"
                className="w-full h-40 sm:h-48 object-cover bg-[color:var(--color-surface-muted)]"
              />
              {i === 3 && post.images.length > 4 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-[18px] font-semibold">
                  +{post.images.length - 4}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <footer className="mt-4 flex items-center gap-1 text-[13px]">
        <ReactionButton
          mine={post.myReaction}
          count={post.likeCount}
          onPick={onReact}
          disabled={!viewer}
        />
        <ActionButton
          onClick={() => {
            if (viewer) setCommentsOpen((v) => !v);
          }}
          active={commentsOpen}
          activeClass="text-[color:var(--color-brand)]"
          count={commentCount}
          label={t("post.comment", "Comment")}
          icon={<ChatIcon />}
        />
        <div className="flex-1" />
        <ActionButton
          onClick={onToggleSave}
          active={post.saved}
          activeClass="text-[color:var(--color-brand)]"
          label={post.saved ? t("post.saved", "Saved") : t("post.save", "Save")}
          icon={<BookmarkIcon filled={post.saved} />}
          count={post.saveCount}
        />
      </footer>

      {viewer && commentsOpen && (
        <CommentThread
          postId={post.id}
          viewer={viewer}
          autoFocus={!defaultCommentsOpen}
          onCreated={() => setCommentCount((c) => c + 1)}
          onDeleted={() => setCommentCount((c) => Math.max(0, c - 1))}
        />
      )}

      {lightbox !== null && (
        <PostLightbox
          post={post}
          viewer={viewer}
          startIndex={lightbox}
          commentCount={commentCount}
          onClose={() => setLightbox(null)}
          onReact={onReact}
          onToggleSave={onToggleSave}
          onReport={() => {
            setLightbox(null);
            onReport();
          }}
          onDelete={
            onDelete
              ? () => {
                  setLightbox(null);
                  onDelete();
                }
              : undefined
          }
          onCommentCreated={() => setCommentCount((c) => c + 1)}
          onCommentDeleted={() => setCommentCount((c) => Math.max(0, c - 1))}
        />
      )}

      {confirmDelete && onDelete && (
        <ConfirmDialog
          title={t("post.deleteTitle", "Delete post?")}
          message={t(
            "post.deleteBody",
            "This permanently removes your post and its replies. This can't be undone.",
          )}
          confirmLabel={t("common.delete", "Delete")}
          onConfirm={() => {
            setConfirmDelete(false);
            onDelete();
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </article>
  );
}

/* ── Building blocks ─────────────────────────────────────────── */

function Avatar({ name, url }: { name: string; url: string | null }) {
  const initials = useMemo(
    () =>
      name
        .split(/\s+/)
        .map((s) => s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    [name],
  );
  if (url) {
    return (
      <Img
        src={url}
        alt=""
        variant="thumb"
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 rounded-full object-cover bg-[color:var(--color-surface-muted)]"
      />
    );
  }
  return (
    <div className="shrink-0 h-10 w-10 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] flex items-center justify-center text-[13px] font-semibold">
      {initials || "?"}
    </div>
  );
}

function ActionButton({
  onClick,
  active,
  activeClass,
  icon,
  label,
  count,
}: {
  onClick: () => void;
  active?: boolean;
  activeClass?: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "min-h-11 inline-flex items-center gap-1.5 px-3 rounded-[10px] text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-text)] transition-colors",
        active && activeClass,
      )}
    >
      {icon}
      {count !== undefined && count > 0 && (
        <span className="tabular-nums text-[12.5px] font-medium">{count}</span>
      )}
    </button>
  );
}

function PostMenu({
  isOwn,
  onReport,
  onDelete,
  onBlock,
}: {
  isOwn: boolean;
  onReport: () => void;
  onDelete?: () => void;
  onBlock?: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("common.more", "More")}
        className="min-h-11 min-w-11 flex items-center justify-center rounded-[10px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)]"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <circle cx="4" cy="10" r="1.6" />
          <circle cx="10" cy="10" r="1.6" />
          <circle cx="16" cy="10" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-48 rounded-[12px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)] py-1 z-10"
        >
          {isOwn ? (
            onDelete ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
                className="w-full text-left min-h-9 px-3 text-[13px] text-[color:var(--color-danger)] hover:bg-[color:var(--color-surface-hover)]"
              >
                {t("lightbox.deletePost", "Delete post")}
              </button>
            ) : (
              <p className="px-3 py-2 text-[12.5px] text-[color:var(--color-text-subtle)]">
                {t("post.ownNothingToReport", "Your post \u2014 nothing to report.")}
              </p>
            )
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onReport();
                }}
                className="w-full text-left min-h-9 px-3 text-[13px] text-[color:var(--color-danger)] hover:bg-[color:var(--color-surface-hover)]"
              >
                {t("lightbox.reportPost", "Report post")}
              </button>
              {onBlock && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onBlock();
                  }}
                  className="w-full text-left min-h-9 px-3 text-[13px] text-[color:var(--color-danger)] hover:bg-[color:var(--color-surface-hover)]"
                >
                  {t("chat.blockUser", "Block user")}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Icons ───────────────────────────────────────────────────── */

function HeartIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill={filled ? "currentColor" : "none"} aria-hidden>
      <path
        d="M10 17s-6-3.5-6-8a3.5 3.5 0 016-2.5A3.5 3.5 0 0116 9c0 4.5-6 8-6 8z"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 6a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2h-3l-3 3v-3H6a2 2 0 01-2-2V6z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
function BookmarkIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill={filled ? "currentColor" : "none"} aria-hidden>
      <path
        d="M5 3.5h10v13l-5-3.5-5 3.5v-13z"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

