"use client";

import type { ReactionType } from "@/lib/reactions";
import { useCallback, useEffect, useState } from "react";
import { PostCard, type FeedPost } from "./post-card";
import { ReportModal } from "./report-modal";
import { useT } from "./locale-context";

interface FeedResponse {
  items: FeedPost[];
  nextCursor: string | null;
}

type Toast = { tone: "ok" | "warn" | "info"; message: string } | null;

/**
 * Reusable post list with the full interaction set (like / save /
 * report + inline comments) shared by the Bookmarks page, the
 * Profile page, and the post detail page. The home feed keeps its
 * own component because it also owns the composer, country reload,
 * and daily-reflection card.
 *
 * Supply either an `endpoint` (GET → { items, nextCursor }, with
 * cursor pagination) or a static `initialItems` array.
 */
export function PostFeedList({
  viewer,
  endpoint,
  initialItems,
  singleOpenComments = false,
  emptyTitle,
  emptySubtitle,
}: {
  viewer: { id: string; displayName: string; avatarUrl: string | null };
  endpoint?: string;
  initialItems?: FeedPost[];
  singleOpenComments?: boolean;
  emptyTitle?: string;
  emptySubtitle?: string;
}) {
  const t = useT();
  const [items, setItems] = useState<FeedPost[]>(initialItems ?? []);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!endpoint);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reportTarget, setReportTarget] = useState<FeedPost | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const pushToast = useCallback((tone: "ok" | "warn" | "info", message: string) => {
    setToast({ tone, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (!endpoint) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const sep = endpoint.includes("?") ? "&" : "?";
      const res = await fetch(`${endpoint}${sep}limit=20`);
      const d = (await res.json().catch(() => null)) as FeedResponse | null;
      if (alive && d) {
        setItems(d.items);
        setCursor(d.nextCursor);
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [endpoint]);

  const onLoadMore = async () => {
    if (!endpoint || !cursor || loadingMore) return;
    setLoadingMore(true);
    const sep = endpoint.includes("?") ? "&" : "?";
    const res = await fetch(`${endpoint}${sep}limit=20&cursor=${encodeURIComponent(cursor)}`);
    const d = (await res.json().catch(() => null)) as FeedResponse | null;
    if (d) {
      setItems((prev) => [...prev, ...d.items]);
      setCursor(d.nextCursor);
    }
    setLoadingMore(false);
  };

  /**
   * Leave, change or take back a reaction.
   *
   * Three outcomes, and the optimistic update has to get all three
   * right or the number flickers: a NEW reaction adds one, taking the
   * SAME one back removes one, and swapping to a DIFFERENT one leaves
   * the count exactly where it was.
   */
  const onReact = async (postId: string, type: ReactionType) => {
    const before = items;
    setItems((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const had = p.myReaction;
        const removing = had === type;
        return {
          ...p,
          myReaction: removing ? null : type,
          liked: !removing,
          likeCount: removing
            ? Math.max(0, p.likeCount - 1)
            : had
              ? p.likeCount
              : p.likeCount + 1,
        };
      }),
    );
  const res = await fetch(`/api/user/posts/${postId}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    if (!res.ok) {
      setItems(before);
      pushToast("warn", "Couldn't save that. Try again.");
      return;
    }
    const d = (await res.json()) as {
      liked: boolean;
      likeCount: number;
      myReaction: ReactionType | null;
    };
    setItems((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, liked: d.liked, likeCount: d.likeCount, myReaction: d.myReaction }
          : p,
      ),
    );
  };

  const onToggleSave = async (postId: string) => {
    const before = items;
    setItems((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              saved: !p.saved,
              saveCount: p.saved ? Math.max(0, p.saveCount - 1) : p.saveCount + 1,
            }
          : p,
      ),
    );
    const res = await fetch(`/api/user/posts/${postId}/save`, { method: "POST" });
    if (!res.ok) {
      setItems(before);
      pushToast("warn", "Couldn't save. Try again.");
      return;
    }
    const d = (await res.json()) as { saved: boolean; saveCount: number };
    setItems((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, saved: d.saved, saveCount: d.saveCount } : p)),
    );
    pushToast(
        "info",
        d.saved ? t("post.savedToast", "Saved.") : t("post.unsaved", "Removed from saved."),
      );
  };

  const onBlockAuthor = async (authorId: string) => {
    const before = items;
    setItems((prev) => prev.filter((p) => p.authorId !== authorId));
    const res = await fetch("/api/user/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: authorId }),
    });
    if (!res.ok) {
      setItems(before);
      pushToast("warn", "Couldn't block. Try again.");
      return;
    }
    pushToast("info", "Blocked. You won't see their posts.");
  };

  const onDeletePost = async (postId: string) => {
    const before = items;
    setItems((prev) => prev.filter((p) => p.id !== postId));
    const res = await fetch(`/api/user/posts/${postId}`, { method: "DELETE" });
    if (!res.ok) {
      setItems(before);
      pushToast("warn", "Couldn't delete the post. Try again.");
      return;
    }
    pushToast("info", t("post.deleted", "Post deleted."));
  };

  if (loading) return <ListSkeleton />;

  if (items.length === 0) {
    return (
      <div className="rounded-[16px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-8 text-center">
        <p className="text-[15px] font-semibold tracking-[-0.01em]">
          {emptyTitle ?? t("feed.emptyTitle", "Nothing here yet.")}
        </p>
        {emptySubtitle && (
          <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">{emptySubtitle}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((p, i) => (
        <PostCard
          key={p.id}
          post={p}
          viewer={viewer}
          defaultCommentsOpen={singleOpenComments && i === 0}
          onReact={(t) => onReact(p.id, t)}
          onToggleSave={() => onToggleSave(p.id)}
          onReport={() => setReportTarget(p)}
          onDelete={() => onDeletePost(p.id)}
          onBlock={!p.isOwn && !p.isAnonymous && p.authorId ? () => onBlockAuthor(p.authorId!) : undefined}
        />
      ))}

      {cursor && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="min-h-11 px-5 rounded-[12px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] text-[13.5px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)] disabled:opacity-50"
          >
            {loadingMore ? t("common.loading", "Loading\u2026") : t("common.loadMore", "Load more")}
          </button>
        </div>
      )}

      {reportTarget && (
        <ReportModal
          post={reportTarget}
          onClose={() => setReportTarget(null)}
          onDone={(duplicate) => {
            setReportTarget(null);
            pushToast(
              "ok",
              duplicate
                ? "You've already reported this. Our team is on it."
                : "Thanks — a moderator will review it.",
            );
          }}
          onError={(msg) => {
            setReportTarget(null);
            pushToast("warn", msg);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-[calc(1.5rem+var(--bottom-nav-h))] left-1/2 -translate-x-1/2 z-40 max-w-sm w-[calc(100%-2rem)]">
          <div
            className={
              toast.tone === "warn"
                ? "rounded-[12px] px-4 py-3 shadow-[var(--shadow-elevated)] text-[13.5px] bg-[color:var(--color-danger)] text-[color:var(--color-on-danger)]"
                : toast.tone === "ok"
                  ? "rounded-[12px] px-4 py-3 shadow-[var(--shadow-elevated)] text-[13.5px] bg-[color:var(--color-success)] text-[color:var(--color-on-success)]"
                  : "rounded-[12px] px-4 py-3 shadow-[var(--shadow-elevated)] text-[13.5px] bg-[color:var(--color-text)] text-[color:var(--color-surface)]"
            }
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-[16px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-4 sm:p-5 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[color:var(--color-surface-muted)]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 rounded bg-[color:var(--color-surface-muted)]" />
              <div className="h-2.5 w-24 rounded bg-[color:var(--color-surface-muted)]" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded bg-[color:var(--color-surface-muted)]" />
            <div className="h-3 w-5/6 rounded bg-[color:var(--color-surface-muted)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
