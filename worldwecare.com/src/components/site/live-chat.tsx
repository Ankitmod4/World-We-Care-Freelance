"use client";

/**
 * Live chat beside a broadcast.
 *
 * READS OVER SSE, WRITES OVER POST. The read path is a single
 * long-lived connection that pushes new comments; the write path is
 * an ordinary request. Two channels rather than one socket, because
 * the server has no pub/sub bus and the chatroom feature already
 * proved this shape works behind nginx.
 *
 * WHAT IT DOES NOT DO: it never renders an empty box to a signed-out
 * viewer with a disabled input and no explanation. Either you can
 * post, or it says why not and offers the way in — a dead control
 * with no reason attached is the most common way a chat panel reads
 * as broken.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Img } from "@/components/ui/img";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";
import { TranslatedContent } from "./translated-content";

export interface LiveCommentDTO {
  id: string;
  authorUserId: string | null;
  authorName: string;
  authorAvatar: string | null;
  body: string;
  createdAt: string;
  isMine: boolean;
  canRemove: boolean;
}

const MAX_BODY = 500;
/** Older messages are dropped from the DOM as new ones arrive. */
const KEEP = 300;

export function LiveChat({
  slug,
  status,
  signedIn,
}: {
  slug: string;
  status: "IDLE" | "LIVE" | "ENDED";
  signedIn: boolean;
}) {
  const t = useT();
  const [comments, setComments] = useState<LiveCommentDTO[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  /*
   * Only autoscroll when the reader is already at the bottom.
   *
   * Scrolling someone back down while they are reading something
   * further up is the single most irritating thing a live chat can
   * do, and on a busy stream it happens every second.
   */
  const onScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  useEffect(() => {
    if (!pinnedRef.current) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments]);

  const merge = useCallback((incoming: LiveCommentDTO[]) => {
    if (incoming.length === 0) return;
    setComments((prev) => {
      // The POST response and the SSE tail can both deliver the same
      // comment — whichever arrives first wins and the other is
      // dropped, rather than the sender seeing their own message
      // twice.
      const seen = new Set(prev.map((c) => c.id));
      const added = incoming.filter((c) => !seen.has(c.id));
      if (added.length === 0) return prev;
      const next = [...prev, ...added];
      return next.length > KEEP ? next.slice(next.length - KEEP) : next;
    });
  }, []);

  // Initial page, then the live tail.
  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;

    (async () => {
      const res = await fetch(`/api/user/live/${slug}/comments`, { cache: "no-store" }).catch(
        () => null,
      );
      if (cancelled) return;
      let after = new Date().toISOString();
      if (res?.ok) {
        const d = (await res.json()) as { comments: LiveCommentDTO[] };
        setComments(d.comments);
        // "<iso>|<id>" so a comment sharing the last one's millisecond
        // isn't skipped by the stream. See @/lib/cursor.
        const newest = d.comments[d.comments.length - 1];
        if (newest) after = `${newest.createdAt}|${newest.id}`;
      }
      setLoaded(true);
      if (cancelled) return;

      // Nothing new can arrive on an ended broadcast, so there is
      // nothing to hold a connection open for.
      if (status === "ENDED") return;

      source = new EventSource(
        `/api/user/live/${slug}/comments/stream?after=${encodeURIComponent(after)}`,
      );
      source.addEventListener("comments", (e) => {
        try {
          merge(JSON.parse((e as MessageEvent).data) as LiveCommentDTO[]);
        } catch {
          /* a malformed frame is not worth tearing the stream down for */
        }
      });
      // EventSource reconnects on its own; this only stops the browser
      // logging an error on every blip.
      source.onerror = () => undefined;
    })();

    return () => {
      cancelled = true;
      source?.close();
    };
  }, [slug, status, merge]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);

    const res = await fetch(`/api/user/live/${slug}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }).catch(() => null);

    setSending(false);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(serverText(t, d?.error) || t("liveChat.sendFailed", "Couldn't send that."));
      return;
    }
    // Cleared only on success, so a failed send does not lose what
    // they typed.
    setDraft("");
    const d = (await res.json()) as { comment: LiveCommentDTO };
    pinnedRef.current = true;
    merge([d.comment]);
  };

  const remove = async (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/user/live/${slug}/comments/${id}`, { method: "DELETE" }).catch(
      () => undefined,
    );
  };

  return (
    /*
     * `min-h` only from `sm` up. On a phone the chat is stacked under
     * the video and a 320pt floor means a mostly-empty box pushing
     * everything else off the screen before anyone has said anything.
     * Stacked, it can simply be as tall as it needs; beside the video
     * it takes the height it is given.
     */
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card sm:min-h-[320px]">
      <header className="flex items-center justify-between border-b border-[color:var(--color-border-soft)] px-4 py-3">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em]">{t("liveChat.title", "Live chat")}</h2>
        {status === "ENDED" && (
          <span className="text-[12px] text-[color:var(--color-text-subtle)]">{t("liveChat.closed", "Closed")}</span>
        )}
      </header>

      <div
        ref={listRef}
        onScroll={onScroll}
        className="max-h-[45dvh] flex-1 space-y-3 overflow-y-auto px-4 py-3 lg:max-h-none"
      >
        {!loaded ? (
          <p className="text-[13px] text-[color:var(--color-text-subtle)]">{t("common.loading", "Loading\u2026")}</p>
        ) : comments.length === 0 ? (
          /*
           * Nothing here while the broadcast has not started.
           *
           * The footer already says "Chat opens when the broadcast
           * starts", and saying it again in the body — which is what
           * this did — reads as a rendering bug rather than as
           * emphasis. The empty state only speaks when it has
           * something the footer does not.
           */
          status === "IDLE" ? null : (
            <p className="text-[13px] text-[color:var(--color-text-subtle)]">
              {status === "LIVE"
                ? t("liveChat.empty", "No comments yet. Say hello.")
                : t("liveChat.emptyEnded", "Nobody commented during this broadcast.")}
            </p>
          )
        ) : (
          comments.map((c) => (
            <article key={c.id} className="group flex gap-2.5">
              <Avatar name={c.authorName} url={c.authorAvatar} />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] leading-tight text-[color:var(--color-text-muted)]">
                  {c.authorUserId ? (
                    <Link href={`/u/${c.authorUserId}`} className="font-semibold hover:underline">
                      {c.authorName}
                    </Link>
                  ) : (
                    <span className="font-semibold">{c.authorName}</span>
                  )}
                </p>
                <p className="whitespace-pre-wrap break-words text-[13.5px] leading-snug">
                  <TranslatedContent kind="liveComment" id={c.id} field="body" text={c.body} toggle={false} />
                </p>
              </div>
              {c.canRemove && (
                <button
                  type="button"
                  onClick={() => void remove(c.id)}
                  // Visible on hover on a pointer device, always
                  // present for keyboards and touch — hiding a
                  // moderation control behind hover on a phone means
                  // there is no moderation control on a phone.
                  className="shrink-0 self-start rounded px-1 text-[11.5px] text-[color:var(--color-text-subtle)] opacity-0 transition-opacity hover:text-[color:var(--color-danger)] focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-0 max-sm:opacity-100"
                  aria-label={t("liveChat.removeComment", "Remove this comment")}
                >
                  {t("payouts.remove", "Remove")}
                </button>
              )}
            </article>
          ))
        )}
      </div>

      <footer className="border-t border-[color:var(--color-border-soft)] p-3">
        {status !== "LIVE" ? (
          <p className="text-[12.5px] text-[color:var(--color-text-subtle)]">
            {status === "ENDED"
              ? t("liveChat.broadcastEnded", "This broadcast has ended.")
              : t("liveChat.opensLater", "Chat opens when the broadcast starts.")}
          </p>
        ) : !signedIn ? (
          <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
            {/* `next` so signing in returns to the broadcast rather
                than dropping them on the home page, which on a live
                stream means they miss the part they were watching. */}
            <Link
              href={`/login?next=${encodeURIComponent(`/live/${slug}`)}`}
              className="font-semibold underline"
            >
              {t("header.signIn", "Sign in")}
            </Link>{" "}
            {t("comments.joinConversation", "to join the conversation.")}
          </p>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  // Enter sends, Shift+Enter breaks the line — the
                  // convention in every chat box people already use.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                maxLength={MAX_BODY}
                placeholder={t("liveChat.placeholder", "Say something…")}
                className="max-h-24 min-h-[38px] flex-1 resize-none rounded-xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] px-3 py-2 text-[13.5px] outline-none focus-visible:border-[color:var(--color-brand)]"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={!draft.trim() || sending}
                className="h-[38px] shrink-0 rounded-xl bg-[color:var(--color-brand)] px-4 text-[13px] font-semibold text-[color:var(--color-on-brand)] disabled:opacity-45"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-[12px] text-[color:var(--color-danger)]" role="status">
                {error}
              </p>
            )}
          </>
        )}
      </footer>
    </section>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <Img src={url} alt="" variant="thumb" className="h-7 w-7 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-soft)] text-[11px] font-semibold text-[color:var(--color-brand-ink)]">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
