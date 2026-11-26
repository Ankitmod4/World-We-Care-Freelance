"use client";

import { applyClipReaction } from "./clip-react";
import type { ReactionType } from "@/lib/reactions";
import { useEffect, useState } from "react";
import { SiteShell, type ShellViewer } from "./site-shell";
import { PostFeedList } from "./post-feed-list";
import { ArticleCard, type ArticleCardData } from "./article-card";
import { ClipCard } from "./clip-card";
import type { ClipView } from "@/lib/clip-view";
import { useT } from "./locale-context";

type Tab = "posts" | "articles" | "clips";

export function SavedClient({ viewer }: { viewer: ShellViewer }) {
  const t = useT();
  const cardViewer = {
    id: viewer.id,
    displayName: viewer.displayName,
    avatarUrl: viewer.avatarUrl,
  };

  const [tab, setTab] = useState<Tab>("posts");
  const [articles, setArticles] = useState<ArticleCardData[] | null>(null);
  const [clips, setClips] = useState<ClipView[] | null>(null);

  // Fetch saved articles lazily — only when the tab is first opened, so
  // the common case (posts) costs nothing extra.
  useEffect(() => {
    if (tab !== "articles" || articles !== null) return;
    let alive = true;
    void (async () => {
      const res = await fetch("/api/user/saved/articles");
      const d = (await res.json().catch(() => ({ articles: [] }))) as {
        articles: ArticleCardData[];
      };
      if (alive) setArticles(d.articles ?? []);
    })();
    return () => {
      alive = false;
    };
  }, [tab, articles]);

  // Same lazy load for clips.
  useEffect(() => {
    if (tab !== "clips" || clips !== null) return;
    let alive = true;
    void (async () => {
      const res = await fetch("/api/user/saved/clips");
      const d = (await res.json().catch(() => ({ clips: [] }))) as { clips: ClipView[] };
      if (alive) setClips(d.clips ?? []);
    })();
    return () => {
      alive = false;
    };
  }, [tab, clips]);

  /**
   * Unsaving from this page removes the card: the list IS "things you
   * saved", so leaving an unsaved clip sitting there would be lying
   * about what the page is.
   */
  const unsaveClip = async (id: string) => {
    setClips((prev) => prev?.filter((c) => c.id !== id) ?? prev);
    await fetch(`/api/user/clips/${id}/save`, { method: "POST" }).catch(() => {});
  };

  const likeClip = async (id: string, type: ReactionType) => {
    setClips((prev) => prev?.map((c) => (c.id === id ? applyClipReaction(c, type) : c)) ?? prev);
    await fetch(`/api/user/clips/${id}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    }).catch(() => {});
  };

  const tabClass = (active: boolean) =>
    `inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[13.5px] font-medium transition-colors duration-200 active:scale-[0.98] sm:min-h-9 ${
      active
        ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
        : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-text)]"
    }`;

  return (
    <SiteShell viewer={viewer}>
      <header className="mb-4">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("saved.title", "Saved")}</h1>
        <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
          {t("saved.blurb", "Posts, articles and clips you've saved to revisit.")}
        </p>
      </header>

      <div className="mb-4 flex gap-2">
        <button type="button" onClick={() => setTab("posts")} className={tabClass(tab === "posts")}>
          {t("saved.posts", "Posts")}
        </button>
        <button
          type="button"
          onClick={() => setTab("articles")}
          className={tabClass(tab === "articles")}
        >
          {t("saved.articles", "Articles")}
          {articles !== null && (
            <span className="tabular-nums opacity-70">{articles.length}</span>
          )}
        </button>
        <button type="button" onClick={() => setTab("clips")} className={tabClass(tab === "clips")}>
          {t("saved.clips", "Clips")}
          {clips !== null && <span className="tabular-nums opacity-70">{clips.length}</span>}
        </button>
      </div>

      {tab === "posts" ? (
        <PostFeedList
          viewer={cardViewer}
          endpoint="/api/user/saved"
          emptyTitle={t("saved.noPosts", "No saved posts yet")}
          emptySubtitle={t("saved.noPostsBlurb", "Tap the bookmark icon on any post to keep it here.")}
        />
      ) : tab === "articles" ? (
        articles === null ? (
          <p className="text-[13px] text-[color:var(--color-text-subtle)]">{t("common.loading", "Loading…")}</p>
        ) : articles.length === 0 ? (
          <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center shadow-card">
            <p className="text-[15px] font-medium">{t("saved.noArticles", "No saved articles yet")}</p>
            <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">
              {t("saved.noArticlesBlurb", "Tap the bookmark icon on any article to keep it here.")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        )
      ) : null}

      {tab === "clips" &&
        (clips === null ? (
          <p className="text-[13px] text-[color:var(--color-text-subtle)]">{t("common.loading", "Loading…")}</p>
        ) : clips.length === 0 ? (
          <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center shadow-card">
            <p className="text-[15px] font-medium">{t("saved.noClips", "No saved clips yet")}</p>
            <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">
              {t("saved.noClipsBlurb", "Tap the bookmark icon on any clip in the Library to keep it here.")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clips.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                showTheme
                onToggleLike={(t) => void likeClip(clip.id, t)}
                onToggleSave={() => void unsaveClip(clip.id)}
              />
            ))}
          </div>
        ))}
    </SiteShell>
  );
}
