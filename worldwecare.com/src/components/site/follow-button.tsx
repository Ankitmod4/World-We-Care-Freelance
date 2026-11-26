"use client";

/**
 * The Follow / Following pill, and the one place that knows how to
 * talk to /api/user/follow.
 *
 * Shared by the right rail's "Who to follow" card and the /members
 * directory. They looked identical when written separately, which is
 * exactly when two copies start to drift — one of them gets the
 * optimistic revert and the other keeps a button that lies after a
 * failed request.
 */

import { useState } from "react";
import { useT } from "./locale-context";

export function FollowButton({
  userId,
  displayName,
  initial = false,
  onChange,
}: {
  userId: string;
  displayName: string;
  initial?: boolean;
  onChange?: (following: boolean) => void;
}) {
  const t = useT();
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    const next = !following;
    setFollowing(next);
    onChange?.(next);
    setBusy(true);
    try {
      const res = await fetch("/api/user/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, follow: next }),
      });
      // The server refuses a blocked pair, and a block can land between
      // the page loading and this click. Without the revert the button
      // would sit there claiming a follow that does not exist.
      if (!res.ok) {
        setFollowing(!next);
        onChange?.(!next);
      }
    } catch {
      setFollowing(!next);
      onChange?.(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={following}
      aria-label={
        following
          ? t("follow.unfollowName", "Unfollow {name}", { name: displayName })
          : t("follow.followName", "Follow {name}", { name: displayName })
      }
      className={
        "min-h-8 shrink-0 rounded-full px-3 text-[11.5px] font-semibold transition-colors " +
        (following
          ? "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-danger-soft)] hover:text-[color:var(--color-danger-ink)]"
          : "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)] hover:bg-[color:var(--color-brand-hover)]")
      }
    >
      {following ? t("follow.following", "Following") : t("follow.follow", "Follow")}
    </button>
  );
}

/** Initials for somebody with no avatar — "Marie O'Donnell" → "MO". */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
