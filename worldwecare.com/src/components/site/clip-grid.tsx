"use client";

/**
 * A grid of clips.
 *
 * Shared by the theme page and the "Following" tab so like/save
 * behaviour and optimistic updates only exist once. Fetching lives
 * here too: the two callers differ by one query string.
 *
 * The grid used to own a modal as well. Opening a clip is a
 * navigation now, so the tiles are plain links and this component is
 * back to being a list.
 */

import { applyClipReaction } from "./clip-react";
import type { ReactionType } from "@/lib/reactions";
import { useCallback, useEffect, useRef, useState } from "react";
import { ClipCard } from "./clip-card";
import type { ClipView } from "@/lib/clip-view";
import { useT } from "./locale-context";

export function ClipGrid({
  query,
  showTheme,
  empty,
}: {
  /** Query string appended to /api/user/library — without the "?". */
  query: string;
  showTheme?: boolean;
  empty: React.ReactNode;
}) {
  const t = useT();
  const [clips, setClips] = useState<ClipView[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setClips(null);
    setError(false);
    void fetch(`/api/user/library?${query}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((d: { clips?: ClipView[] }) => {
        if (alive) setClips(d.clips ?? []);
      })
      .catch(() => {
        if (alive) {
          setError(true);
          setClips([]);
        }
      });
    return () => {
      alive = false;
    };
  }, [query]);

  /**
   * A mirror of `clips` that the callback can read without becoming
   * dependent on it. `toggle` is memoised with an empty dep list; a
   * snapshot taken from the state variable would be whatever it was
   * when the callback was created, not what is on screen now.
   */
  const clipsRef = useRef<ClipView[] | null>(null);
  clipsRef.current = clips;

  /**
   * Optimistic, then reconciled with the server's count. Reverting on
   * failure matters here — a heart that stays filled after a failed
   * write is a lie the reader has no way to notice.
   */
  const toggle = useCallback(
    async (id: string, kind: "like" | "save", type?: ReactionType) => {
      const before = clipsRef.current;
      setClips((prev) =>
        prev?.map((c) =>
          c.id !== id
            ? c
            : kind === "like"
              ? applyClipReaction(c, type ?? "LIKE")
              : { ...c, saved: !c.saved, saveCount: c.saveCount + (c.saved ? -1 : 1) },
        ) ?? prev,
      );

      const res = await fetch(`/api/user/clips/${id}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "like" ? { type: type ?? "LIKE" } : {}),
      }).catch(() => null);
      if (!res?.ok) {
        // Restore the snapshot rather than re-running the maths: with
        // three outcomes, "apply the inverse" is no longer a thing.
        setClips(before);
        return;
      }
      const d = (await res.json().catch(() => ({}))) as {
        liked?: boolean;
        saved?: boolean;
        likeCount?: number;
        saveCount?: number;
        myReaction?: ReactionType | null;
      };
      setClips((prev) =>
        prev?.map((c) =>
          c.id !== id
            ? c
            : {
                ...c,
                ...(typeof d.liked === "boolean" ? { liked: d.liked } : {}),
                ...(typeof d.saved === "boolean" ? { saved: d.saved } : {}),
                ...(typeof d.likeCount === "number" ? { likeCount: d.likeCount } : {}),
                ...(d.myReaction !== undefined ? { myReaction: d.myReaction } : {}),
                ...(typeof d.saveCount === "number" ? { saveCount: d.saveCount } : {}),
              },
        ) ?? prev,
      );
    },
    [],
  );

  if (clips === null) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="animate-pulse overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]"
          >
            <div className="aspect-video w-full bg-[color:var(--color-surface-muted)]" />
            <div className="space-y-2 p-3">
              <div className="h-4 w-3/4 rounded bg-[color:var(--color-surface-muted)]" />
              <div className="h-3 w-1/3 rounded bg-[color:var(--color-surface-muted)]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-8 text-center text-[13.5px] text-[color:var(--color-text-muted)]">
        {t("clips.loadFailed", "Couldn\u2019t load these clips. Refresh to try again.")}
      </p>
    );
  }

  if (clips.length === 0) return <>{empty}</>;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clips.map((clip) => (
        <ClipCard
          key={clip.id}
          clip={clip}
          showTheme={showTheme}
          onToggleLike={(t) => void toggle(clip.id, "like", t)}
          onToggleSave={() => void toggle(clip.id, "save")}
        />
      ))}
    </div>
  );
}
