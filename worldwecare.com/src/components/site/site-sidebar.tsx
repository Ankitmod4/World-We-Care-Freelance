"use client";

/**
 * The left rail — who you are, where you keep your own things, and the
 * rooms you are in.
 *
 * IT USED TO BE THE NAVIGATION: one flat list of sixteen destinations,
 * with a small viewer card at the bottom. The destinations moved to
 * the header as grouped menus, which is what freed this column to be
 * about the member rather than about the site.
 *
 * "YOUR ROOMS" IS BACK, and the note that removed it deserves an
 * answer rather than a silent reversal. It said: /chatrooms already
 * lists these rooms with these counts, and a nav that partially
 * duplicates a page is a second thing to keep in step. That was true
 * and is still true. It is overruled because the rail is no longer a
 * nav — it is the member's own column, and the rooms somebody is
 * already in are theirs in a way the directory is not. The duplication
 * is real; the fix is that both read the same endpoint shape, so
 * neither can drift into its own idea of what a room is.
 *
 * PROGRESS ON THE CARD is the member's OWN view: the streak shows here
 * whether or not they made it public, because `isPublic` governs what
 * OTHER people see and hiding somebody's own number from them was
 * never the point of that flag.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavIcon, type NavIconName } from "./nav-icons";
import { useT } from "./locale-context";
import type { TFunction } from "@/lib/i18n-core";
import type { ShellViewer } from "./site-shell";
import { Img } from "@/components/ui/img";
import { TranslatedContent } from "./translated-content";
import { badgeText } from "@/lib/badge-text";
import { streakName, type StreakKindName } from "@/lib/streak-text";

interface SidebarData {
  stats: { posts: number; followers: number; following: number };
  topStreak: {
    kind: StreakKindName;
    label: string | null;
    name: string;
    emoji: string;
    unit: string;
    days: number;
  } | null;
  badges: Array<{ slug: string; name: string; emoji: string }>;
  badgeCount: number;
  rooms: Array<{
    id: string;
    slug: string;
    name: string;
    emoji: string | null;
    color: string | null;
    tier: string;
    unread: number;
  }>;
}

const QUICK_LINKS: Array<{ key: string; href: string; icon: NavIconName }> = [
  { key: "rail.profile", href: "/profile", icon: "user" },
  { key: "rail.search", href: "/search", icon: "search" },
  { key: "rail.members", href: "/members", icon: "user" },
  { key: "rail.journal", href: "/journal", icon: "journal" },
  { key: "rail.progress", href: "/progress", icon: "spark" },
  { key: "rail.saved", href: "/saved", icon: "bookmark" },
  { key: "rail.messages", href: "/messages", icon: "mail" },
];

/** Literal calls so the extractor can see them — see header-nav.tsx. */
function quickText(t: TFunction): Record<string, string> {
  return {
    "rail.profile": t("rail.profile", "My profile"),
    "rail.search": t("rail.search", "Search"),
    "rail.members": t("rail.members", "Members"),
    "rail.journal": t("rail.journal", "Journal"),
    "rail.progress": t("rail.progress", "Progress"),
    "rail.saved": t("rail.saved", "Saved"),
    "rail.messages": t("rail.messages", "Messages"),
  };
}

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function SiteSidebar({ viewer }: { viewer: ShellViewer }) {
  const t = useT();
  const quick = quickText(t);
  const pathname = usePathname();
  const [data, setData] = useState<SidebarData | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/user/sidebar", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const d = (await res.json().catch(() => null)) as SidebarData | null;
    if (d) setData(d);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const initials = viewer.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="space-y-3">
      {/* ── who you are ─────────────────────────────────── */}
      <div className="overflow-hidden rounded-[16px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
        <div className="h-14 bg-[color:var(--color-brand)]" />
        <div className="-mt-7 px-4 pb-4">
          <Link href="/profile" className="inline-block">
            {viewer.avatarUrl ? (
              <Img
                src={viewer.avatarUrl}
                alt=""
                className="h-14 w-14 rounded-full border-[3px] border-[color:var(--color-surface)] object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-[color:var(--color-surface)] bg-[color:var(--color-brand)] text-[17px] font-bold text-[color:var(--color-on-brand)]">
                {initials}
              </span>
            )}
          </Link>

          <div className="mt-2">
            <Link href="/profile" className="text-[14.5px] font-semibold hover:underline">
              <TranslatedContent
                kind="member"
                id={viewer.id}
                field="displayName"
                text={viewer.displayName}
                toggle={false}
              />
            </Link>
            <p className="truncate text-[12px] text-[color:var(--color-text-subtle)]">
              {viewer.email}
            </p>
          </div>

          {/* The streak, if there is one — the number a member opens
              their own profile to see. */}
          {data?.topStreak && (
            <Link
              href="/progress"
              className="mt-2.5 flex items-baseline justify-between gap-2 rounded-[10px] bg-[color:var(--color-surface-muted)] px-2.5 py-2 transition-colors hover:bg-[color:var(--color-surface-hover)]"
            >
              <span className="min-w-0 truncate text-[12px] text-[color:var(--color-text-muted)]">
                {data.topStreak.emoji} {streakName(t, data.topStreak.kind, data.topStreak.label)}
              </span>
              <span className="shrink-0 text-[15px] font-semibold tabular-nums">
                {data.topStreak.days}
                {/* Just "days". Stripping the leading word off the
                    unit turned "days sober" into "191 sober", which
                    reads like a typo — and the name is already on the
                    left of this row. */}
                <span className="ml-1 text-[11px] font-normal text-[color:var(--color-text-subtle)]">
                  {data.topStreak.days === 1 ? t("rail.day", "day") : t("rail.days", "days")}
                </span>
              </span>
            </Link>
          )}

          {/* Milestones, as chips. Six at most — this is a glance, and
              the full grid is one click away on /progress. */}
          {!!data?.badges.length && (
            <Link href="/progress" className="mt-2 flex flex-wrap items-center gap-1">
              {data.badges.map((b) => (
                <span
                  key={b.slug}
                  title={badgeText(t, b).name}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--color-surface-muted)] text-[12px]"
                >
                  {b.emoji}
                </span>
              ))}
              {data.badgeCount > data.badges.length && (
                <span className="text-[11px] text-[color:var(--color-text-subtle)]">
                  +{data.badgeCount - data.badges.length}
                </span>
              )}
            </Link>
          )}

          <div className="mt-3 flex items-center gap-4 border-t border-[color:var(--color-border-soft)] pt-3">
            <Link href="/profile" className="group text-center">
              <p className="text-[14px] font-bold tabular-nums">{data?.stats.posts ?? 0}</p>
              <p className="text-[10.5px] text-[color:var(--color-text-subtle)] group-hover:text-[color:var(--color-text)]">
                {t("rail.posts", "Posts")}
              </p>
            </Link>
            <Link href="/profile" className="group text-center">
              <p className="text-[14px] font-bold tabular-nums">{data?.stats.followers ?? 0}</p>
              <p className="text-[10.5px] text-[color:var(--color-text-subtle)] group-hover:text-[color:var(--color-text)]">
                {t("rail.followers", "Followers")}
              </p>
            </Link>
            <Link href="/profile" className="group text-center">
              <p className="text-[14px] font-bold tabular-nums">{data?.stats.following ?? 0}</p>
              <p className="text-[10.5px] text-[color:var(--color-text-subtle)] group-hover:text-[color:var(--color-text)]">
                {t("rail.following", "Following")}
              </p>
            </Link>
          </div>
        </div>
      </div>

      {/* ── your own things ─────────────────────────────── */}
      <div className="rounded-[16px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-2.5 shadow-card">
        <p className="mb-1 px-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[color:var(--color-text-subtle)]">
          {t("rail.quickLinks", "Quick links")}
        </p>
        <div className="space-y-0.5">
          {QUICK_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-[10px] px-2 text-[13px] font-medium transition-colors",
                isActive(l.href, pathname)
                  ? "bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)]"
                  : "text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-text)]",
              )}
            >
              <NavIcon name={l.icon} size={17} />
              {quick[l.key]}
            </Link>
          ))}
        </div>
      </div>

      {/* ── the rooms you're in ─────────────────────────── */}
      <div className="rounded-[16px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-2.5 shadow-card">
        <div className="mb-1 flex items-center justify-between px-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[color:var(--color-text-subtle)]">
            {t("rail.yourRooms", "Your rooms")}
          </p>
          <Link
            href="/chatrooms"
            className="text-[11.5px] font-medium text-[color:var(--color-brand)] hover:underline"
          >
            {t("rail.browse", "Browse")}
          </Link>
        </div>

        {data === null ? (
          <div className="space-y-1 px-2 py-1">
            {[0, 1].map((i) => (
              <div key={i} className="h-7 animate-pulse rounded-[8px] bg-[color:var(--color-surface-muted)]" />
            ))}
          </div>
        ) : data.rooms.length === 0 ? (
          /* An invitation, not an empty box — the same rule the home
             strips follow. Rooms are admin-created, so it points at
             the directory rather than at a create button that is not
             theirs to press. */
          <p className="px-2 py-1.5 text-[12px] leading-relaxed text-[color:var(--color-text-subtle)]">
            {t("rail.noRooms", "You haven't joined any yet.")}{" "}
            <Link href="/chatrooms" className="text-[color:var(--color-brand)] hover:underline">
              {t("rail.findOne", "Find one")}
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-0.5">
            {data.rooms.map((r) => (
              <Link
                key={r.id}
                href={`/chatrooms/${r.slug}`}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-[10px] px-2 text-[13px] transition-colors",
                  isActive(`/chatrooms/${r.slug}`, pathname)
                    ? "bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)]"
                    : "text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-text)]",
                )}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px]"
                  style={{ backgroundColor: `${r.color ?? "#94a3b8"}1f` }}
                >
                  {r.emoji ?? "#"}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  <TranslatedContent kind="room" id={r.id} field="name" text={r.name} toggle={false} />
                </span>
                {r.unread > 0 && (
                  <span className="shrink-0 rounded-full bg-[color:var(--color-brand)] px-1.5 text-[10.5px] font-semibold tabular-nums text-[color:var(--color-on-brand)]">
                    {r.unread > 99 ? "99+" : r.unread}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
