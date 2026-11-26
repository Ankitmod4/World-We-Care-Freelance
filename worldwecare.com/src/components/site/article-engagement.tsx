"use client";

/**
 * Reader engagement for an article: like, bookmark, and a threaded
 * comment section.
 *
 * A client island so the article body itself stays a server component
 * (better first paint, and the Markdown parser never ships to the
 * browser).
 *
 * Signed-out readers still SEE counts and the whole discussion — they
 * only get a sign-in prompt when they try to join. That matches the
 * plan's ladder: read first, participate when ready.
 */

import { useMemo, useState } from "react";
import { ReactionButton } from "./reaction-button";
import type { ReactionType } from "@/lib/reactions";
import { formatDayUTC } from "@/lib/timezone";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RichText } from "@/lib/rich-text";
import { Img } from "@/components/ui/img";
import { useT } from "./locale-context";
import { timeAgo } from "@/lib/time-ago";
import { serverText } from "@/lib/i18n-core";
import { TranslatedRichText } from "./translated-markdown";

export interface ArticleComment {
  id: string;
  parentId: string | null;
  authorId: string;
  authorNameSnapshot: string;
  authorAvatarSnapshot: string | null;
  body: string;
  isAnonymous: boolean;
  likeCount: number;
  liked: boolean;
  myReaction: ReactionType | null;
  createdAt: string;
}

interface Viewer {
  id: string;
  displayName: string;
}

/* ── icons ───────────────────────────────────────────────────── */


function BookmarkIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? "currentColor" : "none"} aria-hidden>
      <path
        d="M6.5 4.5h11a1 1 0 0 1 1 1v14l-6.5-4-6.5 4v-14a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReplyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M9 8.5L4.5 13 9 17.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 13h9a6 6 0 0 1 6 6v.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function Avatar({ name, url, size }: { name: string; url: string | null; size: number }) {
  const dim = { width: size, height: size };
  if (url) {
    return (
      <Img
        src={url}
        alt=""
        style={dim}
        className="shrink-0 rounded-full bg-[color:var(--color-surface-muted)] object-cover"
        variant="thumb"
      />
    );
  }
  return (
    <div
      style={dim}
      className="flex shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-soft)] text-[11px] font-semibold text-[color:var(--color-brand-ink)]"
    >
      {name.slice(0, 1).toUpperCase() || "?"}
    </div>
  );
}

/** Same shape as the relative time on post comments. */

/* ── component ───────────────────────────────────────────────── */

export function ArticleEngagement({
  articleId,
  slug,
  viewer,
  initialLiked,
  initialMyReaction,
  initialLikeCount,
  initialSaved,
  initialComments,
}: {
  articleId: string;
  slug: string;
  viewer: Viewer | null;
  initialLiked: boolean;
  initialMyReaction: ReactionType | null;
  initialLikeCount: number;
  initialSaved: boolean;
  initialComments: ArticleComment[];
}) {
  const t = useT();
  const [liked, setLiked] = useState(initialLiked);
  const [myReaction, setMyReaction] = useState<ReactionType | null>(initialMyReaction);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [saved, setSaved] = useState(initialSaved);
  const [comments, setComments] = useState<ArticleComment[]>(initialComments);
  const [draft, setDraft] = useState("");
  const [anon, setAnon] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyAnon, setReplyAnon] = useState(false);

  const signInHref = `/login?next=/articles/${slug}`;

  // Group the flat list into top-level comments + their replies.
  const threads = useMemo(() => {
    const roots = comments.filter((c) => !c.parentId);
    const byParent = new Map<string, ArticleComment[]>();
    for (const c of comments) {
      if (!c.parentId) continue;
      const list = byParent.get(c.parentId) ?? [];
      list.push(c);
      byParent.set(c.parentId, list);
    }
    return roots.map((root) => ({ root, replies: byParent.get(root.id) ?? [] }));
  }, [comments]);

  /** Three outcomes; swapping one reaction for another leaves the count alone. */
  const react = async (type: ReactionType) => {
    if (!viewer) return;
    const had = myReaction;
    const removing = had === type;
    setMyReaction(removing ? null : type);
    setLiked(!removing);
    setLikeCount((c) => (removing ? Math.max(0, c - 1) : had ? c : c + 1));

    const res = await fetch(`/api/user/articles/${articleId}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const d = (await res.json().catch(() => ({}))) as {
      liked?: boolean;
      likeCount?: number;
      myReaction?: ReactionType | null;
    };
    if (!res.ok) {
      setMyReaction(had);
      setLiked(!!had);
      return;
    }
    if (typeof d.liked === "boolean") setLiked(d.liked);
    if (typeof d.likeCount === "number") setLikeCount(d.likeCount);
    if (d.myReaction !== undefined) setMyReaction(d.myReaction);
  };

  const toggleSave = async () => {
    if (!viewer) return;
    setSaved((s) => !s);
    const res = await fetch(`/api/user/articles/${articleId}/save`, { method: "POST" });
    const d = (await res.json().catch(() => ({}))) as { saved?: boolean };
    if (typeof d.saved === "boolean") setSaved(d.saved);
  };

  /** Three outcomes; a swap leaves the count alone. */
  const reactToComment = async (id: string, type: ReactionType) => {
    if (!viewer) return;
    const before = comments;
    setComments((prev) =>
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
    const res = await fetch(`/api/user/articles/comments/${id}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    }).catch(() => null);
    if (!res?.ok) {
      setComments(before);
      return;
    }
    const d = (await res.json().catch(() => ({}))) as {
      liked?: boolean;
      likeCount?: number;
      myReaction?: ReactionType | null;
    };
    setComments((prev) =>
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

  const submit = async (parentId: string | null) => {
    const text = parentId ? replyDraft : draft;
    if (!viewer || !text.trim()) return;
    setPosting(true);
    setError(null);
    const res = await fetch(`/api/user/articles/${articleId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: text,
        isAnonymous: parentId ? replyAnon : anon,
        ...(parentId ? { parentId } : {}),
      }),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string; comment?: ArticleComment };
    setPosting(false);
    if (!res.ok || !d.comment) {
      setError(serverText(t, d?.error) || t("comments.postFailed", "Could not post your comment"));
      return;
    }
    setComments((prev) => [...prev, { ...d.comment!, likeCount: 0, liked: false }]);
    if (parentId) {
      setReplyDraft("");
      setReplyAnon(false);
      setReplyTo(null);
    } else {
      setDraft("");
      setAnon(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(t("comments.deleteConfirm", "Delete your comment?"))) return;
    const res = await fetch(`/api/user/articles/comments/${id}`, { method: "DELETE" });
    // A deleted parent takes its replies with it (DB cascade), so drop
    // them from local state too.
    if (res.ok) setComments((prev) => prev.filter((c) => c.id !== id && c.parentId !== id));
  };

  // Bare icon buttons — no card, border or shadow. Only a soft hover
  // wash so they still read as interactive.
  const actionBtn =
    "inline-flex min-h-11 items-center gap-2 rounded-full px-2.5 text-[14px] font-medium transition-colors duration-200 hover:bg-[color:var(--color-surface-hover)] active:scale-[0.98]";

  const renderComment = (c: ArticleComment, isReply: boolean) => {
    const name = c.isAnonymous ? t("post.anonymous", "Anonymous member") : c.authorNameSnapshot;
    const mine = viewer?.id === c.authorId;
    return (
      // Avatar + bubble, matching the post comment rows in
      // comment-thread.tsx. The previous card-per-comment (white
      // background, border, shadow, 36px action buttons) was roughly
      // twice this tall and looked nothing like the rest of the app.
      <div className="flex items-start gap-2.5">
        <Avatar
          name={c.isAnonymous ? "?" : c.authorNameSnapshot}
          url={c.isAnonymous ? null : c.authorAvatarSnapshot}
          size={isReply ? 28 : 32}
        />
        <div className="min-w-0 flex-1">
          <div className="rounded-[12px] bg-[color:var(--color-surface-muted)] px-3 py-2">
            <div className="flex items-center gap-2">
              <p className="truncate text-[12.5px] font-semibold tracking-[-0.01em]">{name}</p>
              {mine && (
                <span className="rounded-full bg-[color:var(--color-brand-soft)] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-brand-ink)]">
                  {t("post.you", "You")}
                </span>
              )}
            </div>
            <TranslatedRichText
              kind="articleComment"
              id={c.id}
              text={c.body}
              className="mt-0.5 text-[13.5px] leading-relaxed"
            />
          </div>

          <div className="mt-1 ml-1 flex flex-wrap items-center gap-3">
            <span className="text-[11px] text-[color:var(--color-text-subtle)]">
              {/* Date.now()-based; the browser's value is the right
                  one, so don't warn when it differs from SSR. */}
              <span suppressHydrationWarning>{timeAgo(t, c.createdAt)}</span>
            </span>

            <ReactionButton
              mine={c.myReaction}
              count={c.likeCount}
              onPick={(t) => void reactToComment(c.id, t)}
              disabled={!viewer}
              size="sm"
            />

            {/* Only top-level comments offer Reply — threads are capped
                at one level and the server re-parents anything deeper. */}
            {!isReply && viewer && (
              <button
                type="button"
                onClick={() => {
                  setReplyTo((r) => (r === c.id ? null : c.id));
                  setReplyDraft("");
                }}
                className="text-[11px] font-medium text-[color:var(--color-text-subtle)] transition-colors duration-200 hover:text-[color:var(--color-text)]"
              >
                {t("comments.reply", "Reply")}
              </button>
            )}

            {mine && (
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="text-[11px] font-medium text-[color:var(--color-text-subtle)] transition-colors duration-200 hover:text-[color:var(--color-danger)]"
              >
                {t("common.delete", "Delete")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="mt-10 border-t border-[color:var(--color-border-soft)] pt-6">
      {/* ── actions ── */}
      <div className="flex flex-wrap items-center gap-2">
        <ReactionButton
          mine={myReaction}
          count={likeCount}
          onPick={react}
          disabled={!viewer}
        />

        <button
          type="button"
          onClick={toggleSave}
          disabled={!viewer}
          aria-pressed={saved}
          aria-label={
            saved ? t("article.removeBookmark", "Remove bookmark") : t("article.save", "Save article")
          }
          title={saved ? t("post.saved", "Saved") : t("post.save", "Save")}
          className={`${actionBtn} justify-center ${
            saved
              ? "text-[color:var(--color-brand)]"
              : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
          } ${viewer ? "" : "cursor-not-allowed opacity-70"}`}
        >
          <BookmarkIcon filled={saved} className="h-6 w-6" />
        </button>

        {!viewer && (
          <Link
            href={signInHref}
            className="text-[13px] font-medium text-[color:var(--color-brand)] hover:underline"
          >
            {t("article.signInToJoin", "Sign in to join in")}
          </Link>
        )}
      </div>

      {/* ── comments ── */}
      <h2 className="mt-8 text-[18px] font-semibold tracking-[-0.01em]">
        {t("comments.title", "Comments")}
        <span className="ml-2 text-[14px] font-normal tabular-nums text-[color:var(--color-text-subtle)]">
          {comments.length}
        </span>
      </h2>

      {viewer ? (
        <div className="mt-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-3 shadow-card">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder={t("comments.placeholder", "Share a thought — kindly.")}
            className="w-full resize-y rounded-xl border border-[color:var(--color-border)] p-3 text-[14px] outline-none focus:border-[color:var(--color-brand)]"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-[13px] text-[color:var(--color-text-muted)]">
              <input
                type="checkbox"
                checked={anon}
                onChange={(e) => setAnon(e.target.checked)}
                className="h-4 w-4 accent-[color:var(--color-brand)]"
              />
              {t("common.postAnonymously", "Post anonymously")}
            </label>
            <Button size="sm" loading={posting} onClick={() => submit(null)} disabled={!draft.trim()}>
              {t("post.comment", "Comment")}
            </Button>
          </div>
          {error && <p className="mt-2 text-[12.5px] text-[color:var(--color-danger)]">{error}</p>}
        </div>
      ) : (
        <p className="mt-3 text-[13.5px] text-[color:var(--color-text-muted)]">
          <Link href={signInHref} className="font-medium text-[color:var(--color-brand)] hover:underline">
            {t("header.signIn", "Sign in")}
          </Link>{" "}
          {t("comments.joinConversation", "to join the conversation.")}
        </p>
      )}

      <ul className="mt-4 space-y-4">
        {threads.length === 0 && (
          <li className="text-[13.5px] text-[color:var(--color-text-subtle)]">
            {t("comments.noneYetShort", "No comments yet \u2014 be the first.")}
          </li>
        )}
        {threads.map(({ root, replies }) => (
          <li key={root.id}>
            {renderComment(root, false)}

            {replyTo === root.id && viewer && (
              <div className="mt-2 ml-10 rounded-[12px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-2.5 shadow-card">
                <textarea
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  rows={2}
                  autoFocus
                  placeholder={t("comments.replyTo", "Reply to {name}…", {
                    name: root.isAnonymous
                      ? t("comments.anonymous", "Anonymous")
                      : root.authorNameSnapshot,
                  })}
                  className="w-full resize-y rounded-xl border border-[color:var(--color-border)] p-3 text-[14px] outline-none focus:border-[color:var(--color-brand)]"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-[13px] text-[color:var(--color-text-muted)]">
                    <input
                      type="checkbox"
                      checked={replyAnon}
                      onChange={(e) => setReplyAnon(e.target.checked)}
                      className="h-4 w-4 accent-[color:var(--color-brand)]"
                    />
                    {t("common.postAnonymously", "Post anonymously")}
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="text-[13px] font-medium text-[color:var(--color-text-muted)] hover:underline"
                    >
                      {t("common.cancel", "Cancel")}
                    </button>
                    <Button
                      size="sm"
                      loading={posting}
                      onClick={() => submit(root.id)}
                      disabled={!replyDraft.trim()}
                    >
                      {t("comments.reply", "Reply")}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {replies.length > 0 && (
              <ul className="mt-2.5 ml-5 space-y-2.5 border-l border-[color:var(--color-border-soft)] pl-3 sm:ml-6 sm:pl-4">
                {replies.map((r) => (
                  <li key={r.id}>{renderComment(r, true)}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
