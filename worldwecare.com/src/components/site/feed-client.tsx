"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Composer } from "./composer";
import { PostCard, type FeedPost } from "./post-card";
import type { ReactionType } from "@/lib/reactions";
import { ReportModal } from "./report-modal";
import { useCountry } from "./country-context";
import { DailyReflectionCard } from "./daily-reflection-card";
import { ChatroomStrip, EventsStrip, PetitionsStrip, TownHeroesStrip } from "./home-sections";
import type { FeedViewer } from "./feed-page";
import { useT } from "./locale-context";
import { TRich } from "./t-rich";

interface FeedResponse {
  items: FeedPost[];
  nextCursor: string | null;
}

/**
 * Client-side feed. Owns:
 *   • initial load + Load-more pagination
 *   • composer submit → prepends new post
 *   • optimistic like/save with reconciliation
 *   • report modal open/close
 *   • toast messages
 */
export function FeedClient({ viewer }: { viewer: FeedViewer }) {
  const t = useT();
  const { countryId, country } = useCountry();
  const [items, setItems] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reportTarget, setReportTarget] = useState<FeedPost | null>(null);
  const [toast, setToast] = useState<{
    tone: "ok" | "warn" | "info";
    message: string;
  } | null>(null);

  // Compact viewer for the post cards' inline comment composer.
  const cardViewer = {
    id: viewer.id,
    displayName: viewer.displayName,
    avatarUrl: viewer.avatarUrl,
  };

  const pushToast = useCallback(
    (tone: "ok" | "warn" | "info", message: string) => {
      setToast({ tone, message });
      setTimeout(() => setToast(null), 3000);
    },
    [],
  );

  // Reload whenever the active country changes — the shell owns the
  // selection so the feed just reacts.
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const params = new URLSearchParams({ limit: "20" });
      if (countryId) params.set("countryId", countryId);
      const res = await fetch(`/api/user/posts/feed?${params}`);
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
  }, [countryId]);

  const onLoadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const params = new URLSearchParams({ limit: "20", cursor });
    if (countryId) params.set("countryId", countryId);
    const res = await fetch(`/api/user/posts/feed?${params}`);
    const d = (await res.json().catch(() => null)) as FeedResponse | null;
    if (d) {
      setItems((prev) => [...prev, ...d.items]);
      setCursor(d.nextCursor);
    }
    setLoadingMore(false);
  };

  const onPosted = async (newPost: FeedPost) => {
    setItems((prev) => [newPost, ...prev]);
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
      pushToast("warn", t("feed.couldNotSaveThat", "Couldn't save that. Try again."));
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
      pushToast("warn", t("feed.couldNotSave", "Couldn't save. Try again."));
      return;
    }
    const d = (await res.json()) as { saved: boolean; saveCount: number };
    setItems((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, saved: d.saved, saveCount: d.saveCount } : p)),
    );
    pushToast("info", d.saved ? t("feed.saved", "Saved.") : t("feed.unsaved", "Removed from saved."));
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
      pushToast("warn", t("feed.couldNotBlock", "Couldn't block. Try again."));
      return;
    }
    pushToast("info", t("feed.blocked", "Blocked. You won't see their posts."));
  };

  const onDeletePost = async (postId: string) => {
    const before = items;
    setItems((prev) => prev.filter((p) => p.id !== postId));
    const res = await fetch(`/api/user/posts/${postId}`, { method: "DELETE" });
    if (!res.ok) {
      setItems(before);
      pushToast("warn", t("feed.couldNotDelete", "Couldn't delete the post. Try again."));
      return;
    }
    pushToast("info", t("feed.deleted", "Post deleted."));
  };

  return (
    <div className="space-y-4">
      <DailyReflectionCard />
      {country && (
        <div className="flex items-center gap-2 text-[13px] text-[color:var(--color-text-muted)]">
          <span aria-hidden className="text-[16px] leading-none">
            {country.emojiFlag ?? "🏳️"}
          </span>
          <span>
            <TRich
              text={t("feed.showingFrom", "Showing posts from {country} only.")}
              vars={{
                country: (
                  <strong className="text-[color:var(--color-text)] font-semibold">
                    {country.name}
                  </strong>
                ),
              }}
            />
          </span>
        </div>
      )}
      <Composer
        viewer={viewer}
        countryId={countryId}
        countryName={country?.name ?? null}
        countryCode={country?.code ?? null}
        onPosted={onPosted}
        onToast={pushToast}
      />

      {loading ? (
        <FeedSkeleton />
      ) : items.length === 0 ? (
        <>
          <EmptyState />
          {/*
            An empty feed is precisely who needs these most: somebody
            whose country filter has no posts yet, or who joined an
            hour ago. Leaving them out of this branch would show the
            emptiest possible page to the person deciding whether the
            place is worth coming back to.
          */}
          <EventsStrip />
          <ChatroomStrip />
          <TownHeroesStrip />
          <PetitionsStrip />
        </>
      ) : (
        <>
          {/*
            INTERLEAVED, NOT STACKED ON TOP.
            
            Three sections above the feed would push the first post
            below the fold on a phone, and the feed is what people
            opened the app for. Dropped in after a few posts they read
            as something noticed while scrolling, which is also when
            somebody is actually in the mood to be shown a room or an
            event.

            The `>=` guards mean a thin feed does not end up as three
            promos and two posts — on a new or heavily filtered feed
            they simply fall to the bottom in order.
          */}
          {items.map((p, i) => (
            <Fragment key={p.id}>
              <PostCard
                post={p}
                viewer={cardViewer}
                onReact={(t) => onReact(p.id, t)}
                onToggleSave={() => onToggleSave(p.id)}
                onReport={() => setReportTarget(p)}
                onDelete={() => onDeletePost(p.id)}
                onBlock={!p.isOwn && !p.isAnonymous && p.authorId ? () => onBlockAuthor(p.authorId!) : undefined}
              />
              {i === 2 && <EventsStrip />}
              {i === 5 && <ChatroomStrip />}
              {i === 7 && <TownHeroesStrip />}
              {i === 9 && <PetitionsStrip />}
            </Fragment>
          ))}

          {/* Short feed: whichever slots the feed was too short to
              reach, in order, rather than those strips not appearing
              at all. */}
          {items.length <= 2 && <EventsStrip />}
          {items.length <= 5 && <ChatroomStrip />}
          {items.length <= 7 && <TownHeroesStrip />}
          {items.length <= 9 && <PetitionsStrip />}
          {cursor && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="min-h-11 px-5 rounded-[12px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] text-[13.5px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)] disabled:opacity-50"
              >
                {loadingMore ? t("common.loading", "Loading…") : t("common.loadMore", "Load more")}
              </button>
            </div>
          )}
          {!cursor && items.length > 5 && (
            <p className="text-center text-[12px] text-[color:var(--color-text-subtle)] py-4">
              {t("feed.caughtUp", "You're all caught up.")}
            </p>
          )}
        </>
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
                ? t("feed.alreadyReported", "You've already reported this. Our team is on it.")
                : t("feed.reportThanks", "Thanks — a moderator will review it."),
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

/* ── States ──────────────────────────────────────────────────── */

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-[16px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-4 sm:p-5 animate-pulse">
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
            <div className="h-3 w-3/4 rounded bg-[color:var(--color-surface-muted)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <div className="rounded-[16px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-8 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] flex items-center justify-center text-[22px]">
        ✎
      </div>
      <p className="mt-3 text-[15px] font-semibold tracking-[-0.01em]">
        {t("feed.empty", "Be the first voice on the wall.")}
      </p>
      <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
        {t("feed.emptyBlurb", "Share a small win, a struggle, a question. Anonymous if that's safer.")}
      </p>
    </div>
  );
}
