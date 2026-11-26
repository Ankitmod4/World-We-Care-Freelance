"use client";

/**
 * Theme list. Order here is the order members see, so the up/down
 * controls write straight through rather than waiting for a save.
 */

import { useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Img } from "@/components/ui/img";

interface ThemeRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  coverUrl: string | null;
  emoji: string | null;
  isActive: boolean;
  sortOrder: number;
  followerCount: number;
  clipCount: number;
  updatedAt: Date | string;
}

export function LibraryList({ initial }: { initial: ThemeRow[] }) {
  const [themes, setThemes] = useState(initial);
  const [busy, setBusy] = useState(false);

  const move = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= themes.length || busy) return;
    const next = [...themes];
    [next[index], next[target]] = [next[target], next[index]];
    setThemes(next);
    setBusy(true);
    await fetch("/api/admin/library/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((t) => t.id) }),
    }).catch(() => {});
    setBusy(false);
  };

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]">Library</h1>
          <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
            Themed themes of short clips. Members follow a theme; you decide what
            goes in it.
          </p>
        </div>
        <Link href="/admin/library/new">
          <Button size="sm">New theme</Button>
        </Link>
      </div>

      {themes.length === 0 ? (
        <Card>
          <CardBody className="p-10 text-center">
            <p className="text-[15px] font-medium">No themes yet</p>
            <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">
              Start with two or three — exercise, spirituality, recovery — and add clips to each.
            </p>
            <Link href="/admin/library/new">
              <Button size="sm" className="mt-4">Create the first one</Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-[color:var(--color-border-soft)]">
              {themes.map((theme, i) => (
                <li key={theme.id} className="flex items-center gap-3 p-3 sm:px-5">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={i === 0 || busy}
                      onClick={() => void move(i, -1)}
                      className="flex h-6 w-6 items-center justify-center rounded text-[color:var(--color-text-subtle)] hover:bg-[color:var(--color-surface-muted)] disabled:opacity-25"
                    >
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden>
                        <path d="M5 12l5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={i === themes.length - 1 || busy}
                      onClick={() => void move(i, 1)}
                      className="flex h-6 w-6 items-center justify-center rounded text-[color:var(--color-text-subtle)] hover:bg-[color:var(--color-surface-muted)] disabled:opacity-25"
                    >
                      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden>
                        <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>

                  <div className="h-12 w-16 shrink-0 overflow-hidden rounded-[10px] bg-[color:var(--color-surface-muted)]">
                    {theme.coverUrl ? (
                      <Img src={theme.coverUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[20px]">
                        {theme.emoji ?? "✨"}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/library/${theme.id}`}
                      className="text-[14.5px] font-semibold hover:text-[color:var(--color-brand)]"
                    >
                      {theme.name}
                    </Link>
                    {!theme.isActive && (
                      <span className="ml-2 rounded-full bg-[color:var(--color-surface-muted)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
                        Hidden
                      </span>
                    )}
                    {theme.tagline && (
                      <p className="mt-0.5 line-clamp-1 text-[12.5px] text-[color:var(--color-text-muted)]">
                        {theme.tagline}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11.5px] tabular-nums text-[color:var(--color-text-subtle)]">
                      /{theme.slug} · {theme.clipCount} clip{theme.clipCount === 1 ? "" : "s"} ·{" "}
                      {theme.followerCount} follower{theme.followerCount === 1 ? "" : "s"}
                    </p>
                  </div>

                  <Link href={`/admin/library/${theme.id}`}>
                    <Button variant="secondary" size="sm">Manage</Button>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
