"use client";

/**
 * "Thank them too" — the applause count on a hero's page.
 *
 * Optimistic, and it puts the number back if the server disagrees.
 * The count is the only feedback a nominator gets that other people
 * recognised the same person, so it has to feel immediate; but it is
 * also the only number on the page, so it must not be allowed to
 * drift away from the truth.
 */

import { useState } from "react";
import { useT } from "./locale-context";

export function HeroThanks({
  heroId,
  initialCount,
  initialHearted,
}: {
  heroId: string;
  initialCount: number;
  initialHearted: boolean;
}) {
  const t = useT();
  const [count, setCount] = useState(initialCount);
  const [hearted, setHearted] = useState(initialHearted);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const before = { count, hearted };
    setHearted(!hearted);
    setCount((n) => Math.max(0, n + (hearted ? -1 : 1)));

    const res = await fetch(`/api/user/town-heroes/${heroId}/heart`, { method: "POST" }).catch(
      () => null,
    );
    const d = (await res?.json().catch(() => null)) as
      | { hearted?: boolean; heartCount?: number }
      | null;
    setBusy(false);

    if (!res?.ok || typeof d?.heartCount !== "number") {
      setCount(before.count);
      setHearted(before.hearted);
      return;
    }
    setCount(Math.max(0, d.heartCount));
    setHearted(!!d.hearted);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hearted}
      className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold transition-colors ${
        hearted
          ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
          : "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)]"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={hearted ? "currentColor" : "none"} aria-hidden>
        <path
          d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0112 7a3.5 3.5 0 017 3.5c0 5-7 9.5-7 9.5z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
      {hearted ? t("heroes.thanked", "Thanked") : t("heroes.thankThemToo", "Thank them too")}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}
