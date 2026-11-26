"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Live open-reports counter for the sidebar. Polls every 20s and
 * whenever the tab regains visibility — so a mod who steps away and
 * comes back sees the true count without a hard reload.
 *
 * Renders nothing when the count is zero (avoids a permanent tiny
 * badge cluttering the sidebar during quiet times).
 */
export function ReportsCountBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch("/api/admin/posts/reports/count", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const d = (await res.json()) as { openCount: number };
        if (alive) setCount(d.openCount);
      } catch {
        // Silent — sidebar badge, don't spam the console on
        // transient network hiccups.
      }
    };

    load();
    const interval = setInterval(load, 20_000);
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (!count) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full",
        "bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)] text-[10.5px] font-semibold tabular-nums",
        "border border-[color:var(--color-warning-soft)]",
      )}
      title={`${count} open report${count === 1 ? "" : "s"}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
