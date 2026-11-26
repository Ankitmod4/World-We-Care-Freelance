"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InviteAdminModal } from "./invite-modal";

interface Row {
  id: string;
  email: string;
  displayName: string;
  role: "OWNER" | "ADMIN" | "MODERATOR";
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

type StatusFilter = "all" | "active" | "inactive";
type RoleFilter = "all" | "OWNER" | "ADMIN" | "MODERATOR";

const STATUS_TABS: Array<{ v: StatusFilter; label: string }> = [
  { v: "all", label: "All" },
  { v: "active", label: "Active" },
  { v: "inactive", label: "Deactivated" },
];

const ROLE_OPTIONS: Array<{ v: RoleFilter; label: string }> = [
  { v: "all", label: "All roles" },
  { v: "OWNER", label: "Owners" },
  { v: "ADMIN", label: "Admins" },
  { v: "MODERATOR", label: "Moderators" },
];

/**
 * Admins list — mirrors the community-users layout so the mental
 * model transfers. Adds an Invite CTA in the header that opens a
 * modal (rather than a separate page) since the flow is short.
 */
export function AdminsListClient() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [role, setRole] = useState<RoleFilter>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    items: Row[];
    total: number;
    page: number;
    totalPages: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      status,
      role,
      page: String(page),
      perPage: "25",
    });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/admin/admins?${params}`);
    const d = (await res.json().catch(() => null)) as typeof data;
    setData(d);
    setLoading(false);
  }, [q, status, role, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    setPage(1);
  }, [q, status, role]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em]">
            Admins
          </h1>
          <p className="mt-1 text-[14px] text-[color:var(--color-text-muted)]">
            Everyone who can sign in to this admin panel.
          </p>
        </div>
        <Button size="lg" onClick={() => setInviteOpen(true)}>
          Invite admin
        </Button>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Input
              placeholder="Search by name or email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="relative">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as RoleFilter)}
              className="h-11 pl-3 pr-9 rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-sm text-[color:var(--color-text)] appearance-none focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)]"
            >
              {ROLE_OPTIONS.map((s) => (
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
              <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_TABS.map((s) => (
            <button
              key={s.v}
              type="button"
              onClick={() => setStatus(s.v)}
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

      <Card>
        <CardBody className="p-0 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-[13.5px]">
              <thead className="bg-[color:var(--color-surface-muted)]">
                <tr className="text-left">
                  <Th>Person</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Last signed in</Th>
                  <Th>Added</Th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {!loading && data?.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-[color:var(--color-text-subtle)]">
                      No admins match those filters.
                    </td>
                  </tr>
                )}
                {data?.items.map((a) => (
                  <RowDesktop key={a.id} admin={a} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-[color:var(--color-border-soft)]">
            {!loading && data?.items.length === 0 && (
              <div className="text-center py-12 text-[color:var(--color-text-subtle)] text-[13px]">
                No admins match those filters.
              </div>
            )}
            {data?.items.map((a) => (
              <Link
                key={a.id}
                href={`/admin/admins/${a.id}`}
                className="flex items-center gap-3 p-4 hover:bg-[color:var(--color-surface-hover)] transition-colors"
              >
                <Avatar admin={a} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14px] font-medium truncate">{a.displayName}</p>
                    <RolePill role={a.role} />
                    {!a.isActive && <MutedPill label="Deactivated" />}
                  </div>
                  <p className="text-[12px] text-[color:var(--color-text-muted)] truncate">{a.email}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-[13px]">
          <p className="text-[color:var(--color-text-muted)]">
            Page {data.page} of {data.totalPages} · {data.total.toLocaleString()} total
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages}>
              Next
            </Button>
          </div>
        </div>
      )}

      <InviteAdminModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onCreated={() => {
          setInviteOpen(false);
          load();
        }}
      />
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

function RowDesktop({ admin }: { admin: Row }) {
  return (
    <tr className="border-t border-[color:var(--color-border-soft)] hover:bg-[color:var(--color-surface-hover)] transition-colors">
      <td className="px-4 py-3">
        <Link href={`/admin/admins/${admin.id}`} className="flex items-center gap-3 group">
          <Avatar admin={admin} />
          <div className="min-w-0">
            <p className="font-medium text-[color:var(--color-text)] group-hover:text-[color:var(--color-brand)] transition-colors truncate">
              {admin.displayName}
            </p>
            <p className="text-[12.5px] text-[color:var(--color-text-muted)] truncate">
              {admin.email}
            </p>
          </div>
        </Link>
      </td>
      <td className="px-4 py-3">
        <RolePill role={admin.role} />
      </td>
      <td className="px-4 py-3">
        {admin.isActive ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[color:var(--color-success-soft)] text-[color:var(--color-success-ink)] border border-[color:var(--color-success-soft)] text-[10.5px] font-medium">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-[color:var(--color-success)] animate-ping opacity-75" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-[color:var(--color-success)]" />
            </span>
            Active
          </span>
        ) : (
          <MutedPill label="Deactivated" />
        )}
      </td>
      <td className="px-4 py-3 text-[color:var(--color-text-muted)] whitespace-nowrap">
        {admin.lastLoginAt ? relativeTime(admin.lastLoginAt) : "Never"}
      </td>
      <td className="px-4 py-3 text-[color:var(--color-text-muted)] whitespace-nowrap">
        {relativeTime(admin.createdAt)}
      </td>
      <td className="px-4 py-3 text-right pr-4">
        <Link
          href={`/admin/admins/${admin.id}`}
          className="text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline"
        >
          Open
        </Link>
      </td>
    </tr>
  );
}

function Avatar({ admin }: { admin: { displayName: string } }) {
  const initials = useMemo(
    () =>
      admin.displayName
        .split(/\s+/)
        .map((s) => s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    [admin.displayName],
  );
  return (
    <div className="shrink-0 h-9 w-9 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] flex items-center justify-center text-[12.5px] font-semibold">
      {initials || "?"}
    </div>
  );
}

export function RolePill({ role }: { role: "OWNER" | "ADMIN" | "MODERATOR" }) {
  const map = {
    OWNER: {
      cls: "bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)] border-[color:var(--color-warning-soft)]",
      label: "Owner",
    },
    ADMIN: {
      cls: "bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] border-transparent",
      label: "Admin",
    },
    MODERATOR: {
      cls: "bg-[color:var(--color-surface-hover)] text-[color:var(--color-text-muted)] border-transparent",
      label: "Moderator",
    },
  } as const;
  const conf = map[role];
  return (
    <span className={cn("inline-flex px-2 py-0.5 rounded-full border text-[10.5px] font-medium", conf.cls)}>
      {conf.label}
    </span>
  );
}

function MutedPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[color:var(--color-surface-hover)] text-[color:var(--color-text-muted)] text-[10.5px] font-medium">
      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-text-subtle)]" />
      {label}
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
  return `${Math.floor(months / 12)}y ago`;
}
