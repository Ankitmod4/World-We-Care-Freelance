"use client";

/**
 * A threaded comment section.
 *
 * WRITTEN FOR CLIPS, NOW SHARED. The gratitude wall needed the same
 * thing — one level of replies, anonymous posting, delete-with-replies
 * — and a fourth copy of this file (article, clip, confession already
 * exist) would have been a fourth place to fix every bug. The only
 * thing that varied was the two endpoints, so those are props now.
 *
 * `ClipComments` below is the original call signature, kept so the
 * clip pages did not all need editing.
 *
 * One level of replies, matching what the server enforces: a reply to a
 * reply is re-parented to the top of its thread, so this never has to
 * indent twice and the reader never gets a column of text one word
 * wide.
 *
 * It loads on mount rather than behind a "show comments" tap. The
 * component is only rendered when a clip is open — someone watching a
 * two-minute video has already decided they are interested — and a
 * thread that appears only after a second tap mostly does not get read.
 *
 * Deleting a comment takes its replies with it, because the database
 * cascade does. That is said out loud in the confirmation rather than
 * discovered afterwards.
 */

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Img } from "@/components/ui/img";
import { timeAgo } from "@/lib/time-ago";
import { ReactionButton } from "./reaction-button";
import type { ReactionType } from "@/lib/reactions";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";
import {
  TranslationToggle,
  useTranslatedContent,
  type ContentKind,
} from "./translated-content";

const BODY_MAX = 4000;

export interface ThreadComment {
  id: string;
  parentId: string | null;
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

export function ThreadedComments({
  contentKind,
  listUrl,
  commentUrlFor,
  resetKey,
  viewer,
  signInHref = "/login",
  onCountChange,
}: {
  /**
   * Which table these comments live in, so they can be translated.
   *
   * This component is shared by confessions, the gratitude wall and
   * clips, and each of those has its own comment table. The server
   * looks the text up itself rather than trusting the browser to send
   * it, so it has to be told which one — there is no id here that
   * says.
   */
  contentKind: ContentKind;
  /** GET to read the thread, POST to add to it. */
  listUrl: string;
  /** One comment's own URL — DELETE it, or POST to `${url}/like`. */
  commentUrlFor: (commentId: string) => string;
  /**
   * Changes when the subject changes. Everything resets on it, or a
   * half-typed reply follows the reader to the next clip.
   */
  resetKey: string;
  /**
   * Null when nobody is signed in. The thread still renders — a
   * comment nobody outside the login wall can read is a comment
   * written into a drawer — but every control that writes is gone,
   * replaced by one link.
   */
  viewer: { id: string; displayName: string; avatarUrl: string | null } | null;
  signInHref?: string;
  /** So the card outside can keep its count honest. */
  onCountChange?: (count: number) => void;
}) {
  const t = useT();
  const [comments, setComments] = useState<ThreadComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [anon, setAnon] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyAnon, setReplyAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(listUrl, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setComments([]);
      return;
    }
    const d = (await res.json()) as { comments: ThreadComment[] };
    setComments(d.comments ?? []);
  }, [listUrl]);

  useEffect(() => {
    // A different subject is a different thread. Reset everything, or
    // the half-typed reply follows the reader to the next one.
    setComments(null);
    setDraft("");
    setReplyTo(null);
    setReplyDraft("");
    setError(null);
    void load();
  }, [resetKey, load]);

  useEffect(() => {
    if (replyTo) replyRef.current?.focus();
  }, [replyTo]);

  // Flat list in, threads out. One pass, and replies keep the order
  // the server sent them in.
  const threads = useMemo(() => {
    const list = comments ?? [];
    const roots = list.filter((c) => !c.parentId);
    const byParent = new Map<string, ThreadComment[]>();
    for (const c of list) {
      if (!c.parentId) continue;
      const arr = byParent.get(c.parentId) ?? [];
      arr.push(c);
      byParent.set(c.parentId, arr);
    }
    return roots.map((root) => ({ root, replies: byParent.get(root.id) ?? [] }));
  }, [comments]);

  const submit = async (parentId: string | null) => {
    if (!viewer) return;
    const text = (parentId ? replyDraft : draft).trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);

    const res = await fetch(listUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: text,
        isAnonymous: parentId ? replyAnon : anon,
        ...(parentId ? { parentId } : {}),
      }),
    }).catch(() => null);
    setBusy(false);

    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(serverText(t, d?.error) || t("comments.postFailedShort", "Couldn't post that."));
      return;
    }
    const d = (await res.json()) as { comment: ThreadComment; commentCount: number };
    setComments((prev) => [...(prev ?? []), d.comment]);
    onCountChange?.(d.commentCount);

    if (parentId) {
      setReplyDraft("");
      setReplyTo(null);
      setReplyAnon(false);
    } else {
      setDraft("");
      setAnon(false);
    }
  };

  const remove = async (c: ThreadComment) => {
    if (!viewer) return;
    const replies = comments?.filter((x) => x.parentId === c.id).length ?? 0;
    const warning = replies
      ? replies === 1
        ? t("comments.deleteWithOne", "Delete this comment? The 1 reply under it goes too.")
        : t("comments.deleteWithMany", "Delete this comment? The {n} replies under it go too.", {
            n: replies,
          })
      : t("comments.deleteOne", "Delete this comment?");
    if (!window.confirm(warning)) return;

    const res = await fetch(commentUrlFor(c.id), { method: "DELETE" }).catch(
      () => null,
    );
    if (!res?.ok) {
      setError(t("comments.deleteFailedShort", "Couldn't delete that."));
      return;
    }
    const d = (await res.json()) as { commentCount: number };
    // Drop the comment AND anything parented to it — the cascade
    // already did on the server.
    setComments((prev) => (prev ?? []).filter((x) => x.id !== c.id && x.parentId !== c.id));
    onCountChange?.(d.commentCount);
  };

  /**
   * Three outcomes, and only two of them move the count — swapping one
   * reaction for another leaves it exactly where it was. The revert is
   * a snapshot rather than "apply the inverse", because with three
   * outcomes there is no inverse to apply.
   */
  const like = async (c: ThreadComment, type: ReactionType) => {
    if (!viewer) return;
    const before = comments;
    const removing = c.myReaction === type;
    setComments((prev) =>
      (prev ?? []).map((x) =>
        x.id === c.id
          ? {
              ...x,
              myReaction: removing ? null : type,
              liked: !removing,
              likeCount: removing
                ? Math.max(0, x.likeCount - 1)
                : x.myReaction
                  ? x.likeCount
                  : x.likeCount + 1,
            }
          : x,
      ),
    );
    const res = await fetch(`${commentUrlFor(c.id)}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    }).catch(() => null);
    if (!res?.ok) {
      setComments(before);
      return;
    }
    const d = (await res.json()) as {
      liked: boolean;
      likeCount: number;
      myReaction: ReactionType | null;
    };
    setComments((prev) =>
      (prev ?? []).map((x) =>
        x.id === c.id
          ? { ...x, liked: d.liked, likeCount: d.likeCount, myReaction: d.myReaction }
          : x,
      ),
    );
  };

  const total = comments?.length ?? 0;

  return (
    <section
      id="comments"
      // Offset so a #comments jump clears the sticky header rather
      // than parking the heading underneath it.
      className="scroll-mt-24 border-t border-[color:var(--color-border-soft)] pt-4"
    >
      <h3 className="text-[14px] font-semibold tracking-[-0.01em]">
        {total === 0
          ? t("comments.title", "Comments")
          : total === 1
            ? t("comments.oneComment", "1 comment")
            : t("comments.nComments", "{n} comments", { n: total })}
      </h3>

      {viewer ? (
        <Composer
          avatarUrl={viewer.avatarUrl}
          name={viewer.displayName}
          value={draft}
          onChange={setDraft}
          anon={anon}
          onAnonChange={setAnon}
          busy={busy}
          placeholder={t("comments.saySomething", "Say something kind…")}
          onSubmit={() => void submit(null)}
        />
      ) : (
        <p className="mt-3 text-[13px] text-[color:var(--color-text-subtle)]">
          <Link href={signInHref} className="font-medium text-[color:var(--color-brand)] hover:underline">
            {t("header.signIn", "Sign in")}
          </Link>{" "}
          to join the conversation.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[12.5px] text-[color:var(--color-danger)]">
          {error}
        </p>
      )}

      {comments === null ? (
        <p className="mt-4 text-[13px] text-[color:var(--color-text-subtle)]">{t("common.loading", "Loading\u2026")}</p>
      ) : threads.length === 0 ? (
        <p className="mt-4 text-[13px] text-[color:var(--color-text-subtle)]">
          {viewer
            ? t("comments.emptySignedIn", "No comments yet. Yours would be the first.")
            : t("comments.empty", "No comments yet.")}
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {threads.map(({ root, replies }) => (
            <li key={root.id}>
              <Row
                contentKind={contentKind}
                comment={root}
                canAct={!!viewer}
                onLike={(t) => void like(root, t)}
                onDelete={root.isOwn ? () => void remove(root) : undefined}
                onReply={() => setReplyTo(replyTo === root.id ? null : root.id)}
                replying={replyTo === root.id}
              />

              {(replies.length > 0 || (viewer && replyTo === root.id)) && (
                // The one indent. Anything deeper is re-parented here
                // by the server, so this is the only nesting level the
                // component ever has to draw.
                <div className="mt-3 space-y-3 border-l-2 border-[color:var(--color-border-soft)] pl-3 sm:pl-4">
                  {replies.map((r) => (
                    <Row
                      key={r.id}
                      contentKind={contentKind}
                      comment={r}
                      compact
                      canAct={!!viewer}
                      onLike={(t) => void like(r, t)}
                      onDelete={r.isOwn ? () => void remove(r) : undefined}
                      // A reply to a reply lands on the same thread —
                      // matching what the server would do anyway.
                      onReply={() => setReplyTo(replyTo === root.id ? null : root.id)}
                    />
                  ))}

                  {viewer && replyTo === root.id && (
                    <Composer
                      ref={replyRef}
                      avatarUrl={viewer.avatarUrl}
                      name={viewer.displayName}
                      value={replyDraft}
                      onChange={setReplyDraft}
                      anon={replyAnon}
                      onAnonChange={setReplyAnon}
                      busy={busy}
                      compact
                      placeholder={`Reply to ${root.authorName}…`}
                      onSubmit={() => void submit(root.id)}
                      onCancel={() => {
                        setReplyTo(null);
                        setReplyDraft("");
                      }}
                    />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ── one comment ─────────────────────────────────────────────── */

function Row({
  contentKind,
  comment,
  compact,
  canAct,
  onLike,
  onDelete,
  onReply,
  replying,
}: {
  contentKind: ContentKind;
  comment: ThreadComment;
  compact?: boolean;
  /** False for a signed-out reader: the row reads, it does not write. */
  canAct: boolean;
  onLike: (type: ReactionType) => void;
  onDelete?: () => void;
  onReply: () => void;
  replying?: boolean;
}) {
  const t = useT();
  const bodyT = useTranslatedContent(contentKind, comment.id, "body", comment.body);
  const size = compact ? "h-7 w-7" : "h-8 w-8";
  return (
    <div className="flex gap-2.5">
      <Avatar name={comment.authorName} url={comment.authorAvatar} className={size} />

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5">
          {comment.authorId ? (
            <Link
              href={`/u/${comment.authorId}`}
              className="text-[13px] font-semibold hover:text-[color:var(--color-brand)]"
            >
              {comment.authorName}
            </Link>
          ) : (
            <span className="text-[13px] font-semibold text-[color:var(--color-text-muted)]">
              {comment.authorName}
            </span>
          )}
          <span className="text-[11.5px] text-[color:var(--color-text-subtle)]">
            {timeAgo(t, comment.createdAt)}
          </span>
        </p>

        <p className="mt-0.5 whitespace-pre-wrap text-[13.5px] leading-relaxed">
          {bodyT.text}
        </p>

        <div className="mt-1 flex items-center gap-3 text-[12px]">
          {/* Same control as a post, sized down. A reply deserves the
              same six responses as anything else somebody writes here. */}
          <ReactionButton
            mine={comment.myReaction}
            count={comment.likeCount}
            onPick={onLike}
            disabled={!canAct}
            size="sm"
          />

          <TranslationToggle
            state={bodyT}
            className="font-medium text-[color:var(--color-text-subtle)] underline underline-offset-2 hover:text-[color:var(--color-text-muted)]"
          />

          {canAct && (
            <button
              type="button"
              onClick={onReply}
              className="text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-brand)]"
            >
              {replying ? t("common.cancel", "Cancel") : t("comments.reply", "Reply")}
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-danger)]"
            >
              {t("common.delete", "Delete")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── the box you type in ─────────────────────────────────────── */

const Composer = forwardRef<
  HTMLTextAreaElement,
  {
    avatarUrl: string | null;
    name: string;
    value: string;
    onChange: (v: string) => void;
    anon: boolean;
    onAnonChange: (v: boolean) => void;
    busy: boolean;
    placeholder: string;
    compact?: boolean;
    onSubmit: () => void;
    onCancel?: () => void;
  }
>(function Composer(
  { avatarUrl, name, value, onChange, anon, onAnonChange, busy, placeholder, compact, onSubmit, onCancel },
  ref,
) {
  const t = useT();
  const over = value.length > BODY_MAX;
  return (
    <div className={`flex gap-2.5 ${compact ? "mt-1" : "mt-3"}`}>
      <Avatar name={name} url={avatarUrl} className={compact ? "h-7 w-7" : "h-8 w-8"} />
      <div className="min-w-0 flex-1">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={compact ? 2 : 3}
          placeholder={placeholder}
          className="w-full resize-none rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-[13.5px] leading-relaxed outline-none focus:border-[color:var(--color-brand)]"
        />
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-[color:var(--color-text-muted)]">
            <input
              type="checkbox"
              checked={anon}
              onChange={(e) => onAnonChange(e.target.checked)}
              className="h-[15px] w-[15px] accent-[color:var(--color-brand)]"
            />
            {t("common.postAnonymously", "Post anonymously")}
          </label>
          <div className="ml-auto flex items-center gap-2">
            {over && (
              <span className="text-[11.5px] tabular-nums text-[color:var(--color-danger)]">
                {value.length}/{BODY_MAX}
              </span>
            )}
            {onCancel && (
              <Button size="sm" variant="ghost" onClick={onCancel}>
                {t("common.cancel", "Cancel")}
              </Button>
            )}
            <Button size="sm" loading={busy} disabled={!value.trim() || over} onClick={onSubmit}>
              {compact ? t("comments.reply", "Reply") : t("post.comment", "Comment")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

function Avatar({
  name,
  url,
  className,
}: {
  name: string;
  url: string | null;
  className: string;
}) {
  if (url) {
    return (
      <Img
        src={url}
        alt=""
        variant="thumb"
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-[color:var(--color-surface-muted)] text-[12px] font-semibold text-[color:var(--color-text-muted)]`}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}


/**
 * The original clip call signature. Everything above is generic now;
 * this is the one caller that predates that and keeps its own name.
 */
export function ClipComments(props: {
  clipId: string;
  viewer: { id: string; displayName: string; avatarUrl: string | null } | null;
  signInHref?: string;
  onCountChange?: (count: number) => void;
}) {
  const { clipId, ...rest } = props;
  return (
    <ThreadedComments
      {...rest}
      contentKind="clipComment"
      resetKey={clipId}
      listUrl={`/api/user/library/clips/${clipId}/comments`}
      commentUrlFor={(id) => `/api/user/library/comments/${id}`}
    />
  );
}

export type ClipComment = ThreadComment;
