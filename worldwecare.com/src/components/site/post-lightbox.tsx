"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CommentThread } from "./comment-thread";
import { ConfirmDialog } from "./confirm-dialog";
import type { FeedPost } from "./post-card";
import { Img } from "@/components/ui/img";
import { ReactionButton } from "./reaction-button";
import type { ReactionType } from "@/lib/reactions";
import { useT } from "./locale-context";
import { timeAgo } from "@/lib/time-ago";
import { TranslatedRichText } from "./translated-markdown";

/**
 * Instagram-style post lightbox.
 *   • Desktop (lg+): image on a black stage at left, a fixed-height
 *     side panel at right whose comment area scrolls independently.
 *   • Mobile / tablet: one vertical scroll — image on top, then the
 *     author, the like/save actions (pinned right under the author so
 *     they're reachable without scrolling past every comment), the
 *     caption, and the full comment thread.
 */
export function PostLightbox({
  post,
  viewer,
  startIndex,
  commentCount,
  onClose,
  onReact,
  onToggleSave,
  onReport,
  onDelete,
  onCommentCreated,
  onCommentDeleted,
}: {
  post: FeedPost;
  viewer?: { id: string; displayName: string; avatarUrl: string | null };
  startIndex: number;
  commentCount: number;
  onClose: () => void;
  onReact: (type: ReactionType) => void;
  onToggleSave: () => void;
  onReport: () => void;
  onDelete?: () => void;
  onCommentCreated?: () => void;
  onCommentDeleted?: () => void;
}) {
  const t = useT();
  const images = post.images;
  const [index, setIndex] = useState(
    Math.min(Math.max(0, startIndex), Math.max(0, images.length - 1)),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasMany = images.length > 1;
  const prev = () => setIndex((i) => (i - 1 + images.length) % images.length);
  const next = () => setIndex((i) => (i + 1) % images.length);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasMany) prev();
      else if (e.key === "ArrowRight" && hasMany) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMany, images.length, onClose]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const current = images[index];

  return (
    <div className="fixed inset-0 z-[60] flex">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />

      {/* Close — fixed to the viewport so it stays put while the sheet scrolls */}
      <button
        type="button"
        onClick={onClose}
        aria-label={t("common.close", "Close")}
        className="fixed top-3 right-3 z-20 h-10 w-10 flex items-center justify-center rounded-full bg-black/40 lg:bg-white/10 text-white hover:bg-black/60 lg:hover:bg-white/20"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      <div className="relative z-10 flex flex-col lg:flex-row w-full h-full lg:h-auto lg:max-h-[92vh] lg:max-w-6xl lg:m-auto lg:rounded-2xl bg-black lg:bg-[color:var(--color-surface)] overflow-y-auto lg:overflow-hidden overscroll-contain">
        {/* Image stage */}
        <div className="relative bg-black flex items-center justify-center shrink-0 lg:flex-1 lg:min-h-0">
          {current && (
            <Img
              src={current.url}
              alt={current.alt ?? ""}
              priority
              className="w-full lg:w-auto max-h-[62vh] lg:max-h-[92vh] max-w-full object-contain select-none"
            />
          )}

          {hasMany && (
            <>
              <button
                type="button"
                onClick={prev}
                aria-label={t("lightbox.previous", "Previous image")}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 lg:h-10 lg:w-10 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={next}
                aria-label={t("lightbox.next", "Next image")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 lg:h-10 lg:w-10 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {images.map((_, d) => (
                  <span
                    key={d}
                    className={cn("h-1.5 rounded-full transition-all", d === index ? "w-4 bg-white" : "w-1.5 bg-white/50")}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Panel */}
        <div className="bg-[color:var(--color-surface)] flex flex-col w-full shrink-0 lg:w-[400px] lg:min-h-0 rounded-t-2xl -mt-3 lg:mt-0 lg:rounded-none relative">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[color:var(--color-border-soft)] shrink-0">
            <Avatar
              name={post.isAnonymous ? "?" : post.authorName}
              url={post.isAnonymous ? null : post.authorAvatar}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold tracking-[-0.01em] truncate">
                {post.isAnonymous ? t("post.anonymous", "Anonymous member") : post.authorName}
              </p>
              <p className="text-[11.5px] text-[color:var(--color-text-subtle)]">
                {timeAgo(t, post.createdAt)}
                {post.countryName && ` · ${post.countryName}`}
              </p>
            </div>

            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={t("common.more", "More")}
                className="h-9 w-9 flex items-center justify-center rounded-[10px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)]"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <circle cx="4" cy="10" r="1.6" />
                  <circle cx="10" cy="10" r="1.6" />
                  <circle cx="16" cy="10" r="1.6" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-[12px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)] py-1 z-10">
                  {post.isOwn ? (
                    onDelete ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setConfirmDelete(true);
                        }}
                        className="w-full text-left min-h-9 px-3 text-[13px] text-[color:var(--color-danger)] hover:bg-[color:var(--color-surface-hover)]"
                      >
                        {t("lightbox.deletePost", "Delete post")}
                      </button>
                    ) : (
                      <p className="px-3 py-2 text-[12.5px] text-[color:var(--color-text-subtle)]">{t("lightbox.yourPost", "Your post.")}</p>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={onReport}
                      className="w-full text-left min-h-9 px-3 text-[13px] text-[color:var(--color-danger)] hover:bg-[color:var(--color-surface-hover)]"
                    >
                      {t("lightbox.reportPost", "Report post")}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions — pinned right under the author (reachable without scrolling) */}
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[color:var(--color-border-soft)] shrink-0">
            {/* Same control as the feed card: one tap leaves 👍, hover
                or hold opens the full set. Two different like buttons
                for the same post would be its own bug report. */}
            <ReactionButton
              mine={post.myReaction}
              count={post.likeCount}
              onPick={onReact}
              disabled={!viewer}
              placement="bottom"
            />
            <div className="inline-flex items-center gap-1.5 px-3 min-h-11 text-[color:var(--color-text-muted)]">
              <ChatIcon />
              {commentCount > 0 && <span className="tabular-nums text-[12.5px] font-medium">{commentCount}</span>}
            </div>
            <div className="flex-1" />
            <StageAction
              onClick={onToggleSave}
              active={post.saved}
              activeClass="text-[color:var(--color-brand)]"
              count={post.saveCount}
              label={post.saved ? t("post.saved", "Saved") : t("post.save", "Save")}
              icon={<BookmarkIcon filled={post.saved} />}
            />
          </div>

          {/* Caption + comments */}
          <div className="px-4 py-3 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
            {post.body && (
              <div className="text-[14px] leading-relaxed whitespace-pre-wrap break-words mb-1">
              <TranslatedRichText kind="post" id={post.id} text={post.body} />
            </div>
            )}
            {viewer ? (
              <CommentThread
                postId={post.id}
                viewer={viewer}
                onCreated={onCommentCreated}
                onDeleted={onCommentDeleted}
              />
            ) : (
              <p className="mt-3 text-[13px] text-[color:var(--color-text-subtle)]">
                {t("lightbox.signInToReply", "Sign in to read and add replies.")}
              </p>
            )}
          </div>
        </div>
      </div>

      {confirmDelete && onDelete && (
        <ConfirmDialog
          title={t("post.deleteTitle", "Delete post?")}
          message={t(
            "post.deleteBody",
            "This permanently removes your post and its replies. This can't be undone.",
          )}
          confirmLabel={t("common.delete", "Delete")}
          onConfirm={onDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

/* ── bits ──────────────────────────────────────────────────── */

function StageAction({
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
    return <Img src={url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover bg-[color:var(--color-surface-muted)]"
   variant="thumb"
 />;
  }
  return (
    <div className="shrink-0 h-9 w-9 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] flex items-center justify-center text-[12px] font-semibold">
      {initials || "?"}
    </div>
  );
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M4 6a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2h-3l-3 3v-3H6a2 2 0 01-2-2V6z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function BookmarkIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill={filled ? "currentColor" : "none"} aria-hidden>
      <path d="M5 3.5h10v13l-5-3.5-5 3.5v-13z" stroke="currentColor" strokeWidth={filled ? 0 : 1.6} strokeLinejoin="round" />
    </svg>
  );
}

