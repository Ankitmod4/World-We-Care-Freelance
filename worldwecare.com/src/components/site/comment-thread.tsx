"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";
import { cn } from "@/lib/utils";
import { Img } from "@/components/ui/img";
import { ReactionButton } from "./reaction-button";
import type { ReactionType } from "@/lib/reactions";
import { useT } from "./locale-context";
import { timeAgo } from "@/lib/time-ago";
import { TranslationToggle, useTranslatedContent } from "./translated-content";
import { serverText } from "@/lib/i18n-core";

const COMMENT_MAX = 2000;

export interface ThreadComment {
  id: string;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  body: string;
  isAnonymous: boolean;
  likeCount: number;
  liked: boolean;
  myReaction: ReactionType | null;
  isOwn: boolean;
  createdAt: string;
}

interface CommentsResponse {
  items: ThreadComment[];
  nextCursor: string | null;
}

/**
 * Inline comment thread mounted under a post card (and in the
 * lightbox / detail page). Owns its own load + pagination + composer
 * state so a card only pays the cost when the viewer opens it.
 */
export function CommentThread({
  postId,
  viewer,
  onCreated,
  onDeleted,
  autoFocus = false,
}: {
  postId: string;
  viewer: { id: string; displayName: string; avatarUrl: string | null };
  /** Called after a successful post so the card can bump its count. */
  onCreated?: () => void;
  /** Called after a successful delete so the card can drop its count. */
  onDeleted?: () => void;
  autoFocus?: boolean;
}) {
  const t = useT();
  const [items, setItems] = useState<ThreadComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [body, setBody] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const remaining = COMMENT_MAX - body.length;
  const canSubmit = body.trim().length > 0 && remaining >= 0 && !submitting;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/user/posts/${postId}/comments?limit=20`);
    const d = (await res.json().catch(() => null)) as CommentsResponse | null;
    if (d) {
      setItems(d.items);
      setCursor(d.nextCursor);
    }
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const res = await fetch(
      `/api/user/posts/${postId}/comments?limit=20&cursor=${encodeURIComponent(cursor)}`,
    );
    const d = (await res.json().catch(() => null)) as CommentsResponse | null;
    if (d) {
      setItems((prev) => [...prev, ...d.items]);
      setCursor(d.nextCursor);
    }
    setLoadingMore(false);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/user/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, isAnonymous }),
    });
    const d = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      comment?: ThreadComment;
      error?: string;
    };
    setSubmitting(false);
    if (!res.ok || !d.comment) {
      setError(serverText(t, d?.error) || t("comments.postFailedDot", "Couldn't post your comment."));
      return;
    }
    setItems((prev) => [d.comment!, ...prev]);
    setBody("");
    setIsAnonymous(false);
    onCreated?.();
  };

  /**
   * Three outcomes; only two move the count. Reverting is a snapshot
   * because with three outcomes there is no inverse to re-apply.
   */
  const react = async (id: string, type: ReactionType) => {
    if (!viewer) return;
    const before = items;
    setItems((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const removing = c.myReaction === type;
        return {
          ...c,
          myReaction: removing ? null : type,
          liked: !removing,
          likeCount: removing
            ? Math.max(0, c.likeCount - 1)
            : c.myReaction
              ? c.likeCount
              : c.likeCount + 1,
        };
      }),
    );
    const res = await fetch(`/api/user/posts/comments/${id}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    }).catch(() => null);
    if (!res?.ok) {
      setItems(before);
      return;
    }
    const d = (await res.json().catch(() => ({}))) as {
      liked?: boolean;
      likeCount?: number;
      myReaction?: ReactionType | null;
    };
    setItems((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              ...(typeof d.liked === "boolean" ? { liked: d.liked } : {}),
              ...(typeof d.likeCount === "number" ? { likeCount: d.likeCount } : {}),
              ...(d.myReaction !== undefined ? { myReaction: d.myReaction } : {}),
            }
          : c,
      ),
    );
  };

  const deleteOne = async (id: string) => {
    const before = items;
    setItems((prev) => prev.filter((c) => c.id !== id));
    setError(null);
    const res = await fetch(`/api/user/posts/comments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setItems(before);
      setError(t("comments.deleteFailed", "Couldn't delete the comment. Try again."));
      return;
    }
    onDeleted?.();
  };

  return (
    <div className="mt-3 border-t border-[color:var(--color-border-soft)] pt-3">
      {/* Composer */}
      <div className="flex items-start gap-2.5">
        <Avatar
          name={isAnonymous ? "?" : viewer.displayName}
          url={isAnonymous ? null : viewer.avatarUrl}
          size={32}
        />
        <div className="flex-1 min-w-0">
          <textarea
            autoFocus={autoFocus}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("comments.replyPlaceholder", "Write a kind reply…")}
            rows={2}
            maxLength={COMMENT_MAX + 200}
            className="w-full resize-none rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-[13.5px] leading-relaxed placeholder:text-[color:var(--color-text-subtle)] focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)]"
          />
          <div className="mt-1.5 flex items-center justify-between gap-2 flex-wrap">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <span className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="sr-only peer"
                />
                <span className="h-4.5 w-8 rounded-full bg-[color:var(--color-border-strong)] peer-checked:bg-[color:var(--color-brand)] transition-colors" />
                <span className="absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-3.5" />
              </span>
              <span className="text-[12px] text-[color:var(--color-text-muted)]">
                {t("comments.anonymously", "Anonymously")}
              </span>
            </label>
            <div className="flex items-center gap-2 ml-auto">
              {remaining < 200 && (
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    remaining < 0
                      ? "text-[color:var(--color-danger)] font-medium"
                      : "text-[color:var(--color-text-subtle)]",
                  )}
                >
                  {remaining}
                </span>
              )}
              <Button size="sm" loading={submitting} disabled={!canSubmit} onClick={submit}>
                {t("comments.reply", "Reply")}
              </Button>
            </div>
          </div>
          {error && (
            <p className="mt-1 text-[12px] text-[color:var(--color-danger)]">{error}</p>
          )}
        </div>
      </div>

      {/* Thread */}
      <div className="mt-3 space-y-3">
        {loading ? (
          <p className="text-[12.5px] text-[color:var(--color-text-subtle)] py-2">
            {t("comments.loadingReplies", "Loading replies…")}
          </p>
        ) : items.length === 0 ? (
          <p className="text-[12.5px] text-[color:var(--color-text-subtle)] py-1">
            {t("comments.noneYet", "No replies yet \u2014 be the first to respond.")}
          </p>
        ) : (
          items.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              canAct={!!viewer}
              onReact={(t) => void react(c.id, t)}
              onDelete={c.isOwn ? () => setPendingDeleteId(c.id) : undefined}
            />
          ))
        )}
        {cursor && !loading && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline disabled:opacity-50"
          >
            {loadingMore ? t("common.loading", "Loading…") : t("comments.showMore", "Show more replies")}
          </button>
        )}
      </div>

      {pendingDeleteId && (
        <ConfirmDialog
          title={t("comments.deleteTitle", "Delete comment?")}
          message={t("comments.deleteBody", "This permanently removes your reply. This can't be undone.")}
          confirmLabel={t("common.delete", "Delete")}
          onConfirm={() => {
            const id = pendingDeleteId;
            setPendingDeleteId(null);
            void deleteOne(id);
          }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </div>
  );
}

function CommentRow({
  comment,
  canAct,
  onReact,
  onDelete,
}: {
  comment: ThreadComment;
  canAct: boolean;
  onReact: (type: ReactionType) => void;
  onDelete?: () => void;
}) {
  const t = useT();
  const bodyT = useTranslatedContent("comment", comment.id, "body", comment.body);
  return (
    <div className="flex items-start gap-2.5">
      <Avatar
        name={comment.isAnonymous ? "?" : comment.authorName}
        url={comment.isAnonymous ? null : comment.authorAvatar}
        size={32}
      />
      <div className="min-w-0 flex-1">
        <div className="rounded-[12px] bg-[color:var(--color-surface-muted)] px-3 py-2">
          <div className="flex items-center gap-2">
            <p className="text-[12.5px] font-semibold tracking-[-0.01em] truncate">
              {comment.isAnonymous ? t("post.anonymous", "Anonymous member") : comment.authorName}
            </p>
            {comment.isOwn && (
              <span className="text-[9.5px] uppercase tracking-[0.08em] font-semibold px-1.5 py-0.5 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)]">
                {t("post.you", "You")}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">
            {bodyT.text}
          </p>
        </div>
        <div className="mt-1 ml-1 flex items-center gap-3">
          <span className="text-[11px] text-[color:var(--color-text-subtle)]">
            {timeAgo(t, comment.createdAt)}
          </span>
          <TranslationToggle
            state={bodyT}
            className="text-[11px] font-medium text-[color:var(--color-text-subtle)] underline underline-offset-2 hover:text-[color:var(--color-text-muted)]"
          />
          <ReactionButton
            mine={comment.myReaction}
            count={comment.likeCount}
            onPick={onReact}
            disabled={!canAct}
            size="sm"
          />
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="text-[11px] font-medium text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-danger)]"
            >
              {t("common.delete", "Delete")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, url, size = 36 }: { name: string; url: string | null; size?: number }) {
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
  const dim = { width: size, height: size };
  if (url) {
    return (
      <Img
        src={url}
        alt=""
        style={dim}
        className="shrink-0 rounded-full object-cover bg-[color:var(--color-surface-muted)]"
        variant="thumb"
      />
    );
  }
  return (
    <div
      style={dim}
      className="shrink-0 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] flex items-center justify-center text-[12px] font-semibold"
    >
      {initials || "?"}
    </div>
  );
}

