"use client";

/**
 * The admin's own clock. `timeAgo` takes a translator now, and the
 * admin is deliberately not translated — so rather than thread a `t`
 * that would only ever return English through admin screens, this
 * keeps the one line it needs.
 */
function adminTimeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Moderation for one clip's thread.
 *
 * Removal here is a status change, not a delete: the row stays with
 * its reason so the decision can be looked at again, and restoring is
 * one tap. Deleting for real is something only the author can do.
 *
 * It shows anonymous authors' real names, unlike the public thread —
 * a moderator who cannot see who wrote a run of anonymous abuse
 * cannot act on it. That is the one place the two views differ.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";


interface AdminComment {
  id: string;
  parentId: string | null;
  authorId: string | null;
  authorName: string;
  body: string;
  isAnonymous: boolean;
  status: "PUBLISHED" | "REMOVED";
  removedReason: string | null;
  likeCount: number;
  createdAt: string;
}

export function ClipCommentsPanel({
  clipId,
  onCountChange,
}: {
  clipId: string;
  onCountChange?: (n: number) => void;
}) {
  const [rows, setRows] = useState<AdminComment[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/library/clips/${clipId}/comments`, {
      cache: "no-store",
    }).catch(() => null);
    if (!res?.ok) {
      setError("Couldn't load the thread.");
      setRows([]);
      return;
    }
    const d = (await res.json()) as { comments: AdminComment[] };
    setRows(d.comments ?? []);
  }, [clipId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (c: AdminComment) => {
    const remove = c.status === "PUBLISHED";
    let reason: string | null = null;
    if (remove) {
      reason = window.prompt("Reason for removing this comment? (kept on the record)", "");
      if (reason === null) return; // cancelled
    }

    setBusy(c.id);
    setError(null);
    const res = await fetch(`/api/admin/library/comments/${c.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: remove ? "remove" : "restore", reason }),
    }).catch(() => null);
    setBusy(null);

    if (!res?.ok) {
      setError("Couldn't update that.");
      return;
    }
    const d = (await res.json()) as { status: AdminComment["status"]; commentCount: number };
    setRows((prev) =>
      (prev ?? []).map((x) =>
        x.id === c.id
          ? { ...x, status: d.status, removedReason: remove ? reason : null }
          : x,
      ),
    );
    onCountChange?.(d.commentCount);
  };

  if (rows === null) {
    return <p className="text-[12.5px] text-[color:var(--color-text-subtle)]">Loading…</p>;
  }
  if (rows.length === 0) {
    return <p className="text-[12.5px] text-[color:var(--color-text-subtle)]">No comments on this clip.</p>;
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-[12px] text-[color:var(--color-danger)]">{error}</p>}
      <ul className="space-y-2">
        {rows.map((c) => (
          <li
            key={c.id}
            className={`rounded-lg border border-[color:var(--color-border-soft)] p-2.5 ${
              c.parentId ? "ml-5" : ""
            } ${c.status === "REMOVED" ? "opacity-60" : ""}`}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-[color:var(--color-text-subtle)]">
              <span className="font-semibold text-[color:var(--color-text)]">{c.authorName}</span>
              {c.isAnonymous && (
                <span className="rounded-full bg-[color:var(--color-surface-muted)] px-1.5 py-0.5 text-[10.5px]">
                  posted anonymously
                </span>
              )}
              {c.parentId && <span>reply</span>}
              <span>{adminTimeAgo(c.createdAt)}</span>
              {c.likeCount > 0 && <span className="tabular-nums">{c.likeCount} likes</span>}
              {c.status === "REMOVED" && (
                <span className="font-medium text-[color:var(--color-danger)]">removed</span>
              )}
            </div>

            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed">{c.body}</p>

            {c.removedReason && (
              <p className="mt-1 text-[11.5px] italic text-[color:var(--color-text-subtle)]">
                Reason: {c.removedReason}
              </p>
            )}

            <div className="mt-1.5 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                loading={busy === c.id}
                onClick={() => void act(c)}
              >
                {c.status === "PUBLISHED" ? "Remove" : "Restore"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
