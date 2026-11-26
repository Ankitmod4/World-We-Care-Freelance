"use client";

/**
 * /journal — the private journal.
 *
 * THE PROMISE ON THIS PAGE IS THE WHOLE FEATURE. Every visible piece of
 * copy says the same thing in a different way: nobody else reads this.
 * That is not decoration. A member who is not certain will write the
 * safe version of what they meant, and the safe version is no use to
 * them.
 *
 * Sharing is deliberately awkward — a second click, and a line telling
 * them it cannot be undone. Everything else on this page is one click.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/time-ago";
import type { JournalEntry } from "@/lib/journal";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";
import { TranslatedContent } from "./translated-content";

export function JournalClient({
  viewer,
  todayQuestion,
}: {
  viewer: ShellViewer;
  todayQuestion: { id: string; body: string } | null;
}) {
  const t = useT();
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [sharing, setSharing] = useState<JournalEntry | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/user/journal", { cache: "no-store" }).catch(() => null);
    const d = (await res?.json().catch(() => ({}))) as {
      entries?: JournalEntry[];
      nextCursor?: string | null;
      total?: number;
    };
    setEntries(d?.entries ?? []);
    setCursor(d?.nextCursor ?? null);
    setTotal(d?.total ?? 0);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const more = async () => {
    if (!cursor) return;
    const res = await fetch(`/api/user/journal?cursor=${encodeURIComponent(cursor)}`, {
      cache: "no-store",
    }).catch(() => null);
    const d = (await res?.json().catch(() => ({}))) as {
      entries?: JournalEntry[];
      nextCursor?: string | null;
    };
    setEntries((prev) => [...(prev ?? []), ...(d?.entries ?? [])]);
    setCursor(d?.nextCursor ?? null);
  };

  const write = async () => {
    setError(null);
    setSaving(true);
    const res = await fetch("/api/user/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }).catch(() => null);
    const d = (await res?.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res?.ok) {
      setError(serverText(t, d?.error) || t("journal.saveFailed", "Couldn't save that."));
      return;
    }
    setBody("");
    void load();
  };

  const saveEdit = async (id: string) => {
    await fetch(`/api/user/journal/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editBody }),
    }).catch(() => null);
    setEditing(null);
    void load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/user/journal/${id}`, { method: "DELETE" }).catch(() => null);
    void load();
  };

  const doShare = async (entry: JournalEntry, isAnonymous: boolean) => {
    await fetch(`/api/user/journal/${entry.id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAnonymous }),
    }).catch(() => null);
    setSharing(null);
    void load();
  };

  return (
    <SiteShell viewer={viewer}>
      <header className="mb-4">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("journal.title", "Your journal")}</h1>
        <p className="mt-0.5 max-w-[62ch] text-[13.5px] text-[color:var(--color-text-muted)]">
          {t(
            "journal.subtitle",
            "A private space to write what you can't say out loud yet. Nobody else can read this — not other members, not moderators.",
          )}
        </p>
      </header>

      <div className="mb-5 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-4 shadow-card sm:p-5">
        {todayQuestion && (
          <p className="mb-2.5 rounded-[12px] bg-[color:var(--color-surface-muted)] px-3.5 py-2.5 text-[13.5px] leading-relaxed">
            <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--color-text-subtle)]">
              {t("journal.todaysQuestion", "Today's question")}
            </span>
            <TranslatedContent
              kind="dailyQuestion"
              id={todayQuestion.id}
              field="body"
              text={todayQuestion.body}
              toggle={false}
            />
          </p>
        )}
        <textarea
          ref={composer}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder={t("journal.placeholder", "Anything at all. It stays here.")}
          className="w-full resize-y rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3.5 py-3 text-[14.5px] leading-relaxed outline-none focus:border-[color:var(--color-brand)]"
        />
        {error && <p className="mt-1.5 text-[12.5px] text-[color:var(--color-danger)]">{error}</p>}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={write} loading={saving} disabled={!body.trim()}>
            {t("journal.savePrivately", "Save privately")}
          </Button>
          <span className="text-[12px] text-[color:var(--color-text-subtle)]">
            {total > 0
              ? total === 1
                ? t("journal.oneEntry", "1 entry so far")
                : t("journal.nEntries", "{n} entries so far", { n: total })
              : t("common.nothingHere", "Nothing here yet")}
          </span>
        </div>
      </div>

      {entries === null ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)]"
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center shadow-card">
          <p className="text-[15px] font-medium">{t("journal.empty", "Nothing written yet")}</p>
          <p className="mx-auto mt-1 max-w-[46ch] text-[13.5px] text-[color:var(--color-text-muted)]">
            {t(
              "journal.emptyBlurb",
              "The first entry is the hardest. It doesn't have to be good — nobody is going to read it.",
            )}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((e) => (
            <li
              key={e.id}
              className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-4 shadow-card"
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[12px] text-[color:var(--color-text-subtle)]">
                <span>{timeAgo(t, e.createdAt)}</span>
                {e.question && (
                  <span className="rounded-full bg-[color:var(--color-surface-muted)] px-2 py-0.5">
                    {t("journal.answeredDaily", "Answered the daily question")}
                  </span>
                )}
                {e.sharedPostId && (
                  <span className="rounded-full bg-[color:var(--color-brand)]/10 px-2 py-0.5 font-semibold text-[color:var(--color-brand)]">
                    {t("journal.shared", "Shared")}
                  </span>
                )}
              </div>

              {e.question && (
                <p className="mb-1.5 text-[12.5px] italic text-[color:var(--color-text-muted)]">
                  {e.question.body}
                </p>
              )}

              {editing === e.id ? (
                <>
                  <textarea
                    value={editBody}
                    onChange={(ev) => setEditBody(ev.target.value)}
                    rows={5}
                    className="w-full resize-y rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3.5 py-3 text-[14.5px] leading-relaxed outline-none focus:border-[color:var(--color-brand)]"
                  />
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => void saveEdit(e.id)}>
                      {t("common.save", "Save")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      {t("common.cancel", "Cancel")}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed">{e.body}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(e.id);
                        setEditBody(e.body);
                      }}
                    >
                      {t("common.edit", "Edit")}
                    </Button>
                    {!e.sharedPostId && (
                      <Button size="sm" variant="ghost" onClick={() => setSharing(e)}>
                        {t("journal.shareThis", "Share this")}
                      </Button>
                    )}
                    {e.sharedPostId && (
                      <Link
                        href={`/posts/${e.sharedPostId}`}
                        className="inline-flex h-8 items-center rounded-[10px] px-3 text-[13px] text-[color:var(--color-brand)] hover:underline"
                      >
                        {t("journal.seePost", "See the post")}
                      </Link>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[color:var(--color-danger)]"
                      onClick={() => void remove(e.id)}
                    >
                      {t("common.delete", "Delete")}
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {cursor && (
        <div className="mt-4 text-center">
          <Button size="sm" variant="secondary" onClick={more}>
            {t("journal.older", "Older entries")}
          </Button>
        </div>
      )}

      {/*
        Sharing gets a confirm and the other actions do not, because it
        is the only one that cannot be taken back: the post is a copy,
        so deleting the entry afterwards would not unpublish it.
      */}
      {sharing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget) setSharing(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("journal.shareAria", "Share this entry")}
            className="w-full max-w-md rounded-2xl bg-[color:var(--color-surface)] p-5 shadow-elevated"
          >
            <h2 className="text-[16px] font-semibold">{t("journal.shareTitle", "Share this entry?")}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-text-muted)]">
              {t(
                "journal.shareBlurb",
                "This copies the words into a post on the community wall. Your journal entry stays here either way — but the post is its own thing, so deleting the entry afterwards won't remove it.",
              )}
            </p>
            <p className="mt-2.5 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-[12px] bg-[color:var(--color-surface-muted)] p-3 text-[13.5px] leading-relaxed">
              {sharing.body}
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSharing(null)}>
                {t("journal.notYet", "Not yet")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void doShare(sharing, true)}>
                {t("journal.shareAnon", "Share anonymously")}
              </Button>
              <Button size="sm" onClick={() => void doShare(sharing, false)}>
                {t("journal.shareAsMe", "Share as me")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </SiteShell>
  );
}
