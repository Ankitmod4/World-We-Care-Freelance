"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Img } from "@/components/ui/img";

interface Row {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isActive: boolean;
  bannedAt: string | null;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  activityCount: number;
}

type Status = "all" | "active" | "inactive" | "banned" | "unverified";
type Sort = "created_desc" | "created_asc" | "last_login" | "name";

const STATUS_TABS: Array<{ v: Status; label: string }> = [
  { v: "all", label: "All" },
  { v: "active", label: "Active" },
  { v: "inactive", label: "Deactivated" },
  { v: "banned", label: "Banned" },
  { v: "unverified", label: "Unverified" },
];

const SORT_OPTIONS: Array<{ v: Sort; label: string }> = [
  { v: "created_desc", label: "Newest first" },
  { v: "created_asc", label: "Oldest first" },
  { v: "last_login", label: "Recently signed in" },
  { v: "name", label: "Name A→Z" },
];

/**
 * Community users list.
 *
 * Full-width table on desktop, card list on mobile per DESIGN_RULES.
 * Search / status filter / sort are all URL-independent for now
 * (the page is admin-only and rarely bookmarked).
 */
export function UsersListClient() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [sort, setSort] = useState<Sort>("created_desc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    items: Row[];
    total: number;
    page: number;
    totalPages: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      status,
      sort,
      page: String(page),
      perPage: "25",
    });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/admin/users?${params}`);
    const d = (await res.json().catch(() => null)) as typeof data;
    setData(d);
    setLoading(false);
  }, [q, status, sort, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    setPage(1);
  }, [q, status, sort]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em]">
            Community users
          </h1>
          <p className="mt-1 text-[14px] text-[color:var(--color-text-muted)]">
            Search, moderate, and audit every account on the platform.
          </p>
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Input
              placeholder="Search by email or display name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-11 pl-3 pr-9 rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-sm text-[color:var(--color-text)] appearance-none focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)]"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.label}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-[color:var(--color-text-subtle)] pointer-events-none"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden
            >
              <path
                d="M3 5l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_TABS.map((s) => (
            <button
              key={s.v}
              onClick={() => setStatus(s.v)}
              type="button"
              className={cn(
                "px-3.5 h-9 rounded-full text-[12.5px] font-medium border transition-colors",
                status === s.v
                  ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)] border-transparent"
                  : "bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] border-[color:var(--color-border)] hover:text-[color:var(--color-text)]",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <Card>
        <CardBody className="p-0 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-[13.5px]">
              <thead className="bg-[color:var(--color-surface-muted)]">
                <tr className="text-left">
                  <Th>User</Th>
                  <Th>Status</Th>
                  <Th>Joined</Th>
                  <Th>Last seen</Th>
                  <Th>Events</Th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {!loading && data?.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-[color:var(--color-text-subtle)]">
                      No users match those filters.
                    </td>
                  </tr>
                )}
                {data?.items.map((u) => (
                  <UserRowDesktop key={u.id} user={u} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-[color:var(--color-border-soft)]">
            {!loading && data?.items.length === 0 && (
              <div className="text-center py-12 text-[color:var(--color-text-subtle)] text-[13px]">
                No users match those filters.
              </div>
            )}
            {data?.items.map((u) => (
              <Link
                key={u.id}
                href={`/admin/users/${u.id}`}
                className="flex items-center gap-3 p-4 hover:bg-[color:var(--color-surface-hover)] transition-colors"
              >
                <Avatar user={u} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-medium truncate">
                      {u.displayName}
                    </p>
                    <StatusPill user={u} />
                  </div>
                  <p className="text-[12px] text-[color:var(--color-text-muted)] truncate">
                    {u.email}
                  </p>
                  <p className="text-[11.5px] text-[color:var(--color-text-subtle)] mt-0.5">
                    Joined {relativeTime(u.createdAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-[13px]">
          <p className="text-[color:var(--color-text-muted)]">
            Page {data.page} of {data.totalPages} · {data.total.toLocaleString()} total
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)]">
      {children}
    </th>
  );
}

function UserRowDesktop({ user }: { user: Row }) {
  return (
    <tr className="border-t border-[color:var(--color-border-soft)] hover:bg-[color:var(--color-surface-hover)] transition-colors">
      <td className="px-4 py-3">
        <Link href={`/admin/users/${user.id}`} className="flex items-center gap-3 group">
          <Avatar user={user} />
          <div className="min-w-0">
            <p className="font-medium text-[color:var(--color-text)] group-hover:text-[color:var(--color-brand)] transition-colors truncate">
              {user.displayName}
            </p>
            <p className="text-[12.5px] text-[color:var(--color-text-muted)] truncate">
              {user.email}
            </p>
          </div>
        </Link>
      </td>
      <td className="px-4 py-3">
        <StatusPill user={user} />
      </td>
      <td className="px-4 py-3 text-[color:var(--color-text-muted)] whitespace-nowrap">
        {relativeTime(user.createdAt)}
      </td>
      <td className="px-4 py-3 text-[color:var(--color-text-muted)] whitespace-nowrap">
        {user.lastLoginAt ? relativeTime(user.lastLoginAt) : "—"}
      </td>
      <td className="px-4 py-3 tabular-nums text-[color:var(--color-text-muted)]">
        {user.activityCount.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-right pr-4">
        <Link
          href={`/admin/users/${user.id}`}
          className="text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline"
        >
          Open
        </Link>
      </td>
    </tr>
  );
}

function Avatar({ user }: { user: { avatarUrl: string | null; displayName: string } }) {
  const initials = useMemo(
    () =>
      user.displayName
        .split(/\s+/)
        .map((s) => s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    [user.displayName],
  );
  return (
    <div className="shrink-0 h-9 w-9 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] flex items-center justify-center overflow-hidden">
      {user.avatarUrl ? (
        <Img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-[12.5px] font-semibold">{initials || "?"}</span>
      )}
    </div>
  );
}

function StatusPill({
  user,
}: {
  user: {
    isActive: boolean;
    bannedAt: string | null;
    emailVerifiedAt: string | null;
  };
}) {
  if (user.bannedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger-ink)] border border-[color:var(--color-danger-soft)] text-[10.5px] font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-danger)]" />
        Banned
      </span>
    );
  }
  if (!user.isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[color:var(--color-surface-hover)] text-[color:var(--color-text-muted)] text-[10.5px] font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-text-subtle)]" />
        Deactivated
      </span>
    );
  }
  if (!user.emailVerifiedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)] border border-[color:var(--color-warning-soft)] text-[10.5px] font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-warning)]" />
        Unverified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[color:var(--color-success-soft)] text-[color:var(--color-success-ink)] border border-[color:var(--color-success-soft)] text-[10.5px] font-medium">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inset-0 rounded-full bg-[color:var(--color-success)] animate-ping opacity-75" />
        <span className="relative rounded-full h-1.5 w-1.5 bg-[color:var(--color-success)]" />
      </span>
      Active
    </span>
  );
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}
