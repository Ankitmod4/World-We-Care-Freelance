"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PostImages } from "@/components/admin/post-images";
import { VideoPlayer } from "@/components/ui/video-player";
import { Img } from "@/components/ui/img";

type StatusFilter = "all" | "published" | "pending" | "removed" | "reported";

interface Post {
  id: string;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  authorEmail: string | null;
  body: string;
  images: Array<{ url: string; alt?: string | null }>;
  video: {
    assetId: string;
    url: string;
    posterUrl: string | null;
    width: number | null;
    height: number | null;
    durationSec: number | null;
  } | null;
  isAnonymous: boolean;
  status: "PUBLISHED" | "PENDING" | "REMOVED" | "DRAFT";
  isFeatured: boolean;
  removedReason: string | null;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  reportCount: number;
  countryName: string | null;
  createdAt: string;
}

interface Stats {
  postsTotal: number;
  postsPublished: number;
  postsRemoved: number;
  commentsTotal: number;
  reportsOpen: number;
  reportsResolvedLast7d: number;
}

const STATUS_TABS: Array<{ v: StatusFilter; label: string; badgeKey?: keyof Stats }> = [
  { v: "all",       label: "All",       badgeKey: "postsTotal" },
  { v: "published", label: "Published", badgeKey: "postsPublished" },
  { v: "reported",  label: "Reported" },
  { v: "removed",   label: "Removed",   badgeKey: "postsRemoved" },
  { v: "pending",   label: "Pending" },
];

/**
 * Community wall admin — top-level layout mirrors the users list
 * (stats strip → tabs → search → cards). Below the cards lives the
 * report queue, which admins usually want to work through before
 * the general feed.
 */
export function PostsClient() {
  const [tab, setTab] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    items: Post[];
    total: number;
    totalPages: number;
  } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status: tab, page: String(page), perPage: "25" });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/admin/posts?${params}`);
    const d = await res.json().catch(() => null);
    setData(d);
    setLoading(false);
  }, [tab, page, q]);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/admin/posts/stats");
    if (res.ok) setStats(await res.json());
  }, []);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    setPage(1);
  }, [tab, q]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <header>
        <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em]">Community wall</h1>
        <p className="mt-1 text-[14px] text-[color:var(--color-text-muted)]">
          Every post from every member — moderate reports first, then browse.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Posts" value={stats?.postsTotal} sub={stats && `${stats.postsPublished} live`} />
        <StatCard label="Comments" value={stats?.commentsTotal} />
        <StatCard label="Open reports" value={stats?.reportsOpen} accent={stats && stats.reportsOpen > 0 ? "warn" : undefined} />
        <StatCard label="Resolved (7d)" value={stats?.reportsResolvedLast7d} />
      </div>

      {stats && stats.reportsOpen > 0 && (
        <Link
          href="/admin/posts/reports"
          className="block rounded-[14px] bg-[color:var(--color-warning-soft)] border border-[color:var(--color-warning-soft)] px-4 py-3 hover:bg-[color:var(--color-warning-soft)] transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="shrink-0 h-9 w-9 rounded-full bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)] flex items-center justify-center font-semibold tabular-nums text-[14px]">
                {stats.reportsOpen > 99 ? "99+" : stats.reportsOpen}
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-[color:var(--color-warning-ink)]">
                  {stats.reportsOpen} open report{stats.reportsOpen === 1 ? "" : "s"} waiting
                </p>
                <p className="text-[12px] text-[color:var(--color-warning-ink)]/80">
                  Review before they pile up.
                </p>
              </div>
            </div>
            <span className="shrink-0 text-[12.5px] font-medium text-[color:var(--color-warning-ink)]">
              Open queue →
            </span>
          </div>
        </Link>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t.v}
              type="button"
              onClick={() => setTab(t.v)}
              className={cn(
                "inline-flex items-center gap-2 px-4 h-10 rounded-full text-[13px] font-medium border transition-colors",
                tab === t.v
                  ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)] border-transparent shadow-[var(--shadow-brand)]"
                  : "bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] border-[color:var(--color-border)] hover:text-[color:var(--color-text)]",
              )}
            >
              {t.label}
              {t.badgeKey && stats && (
                <span className={cn(
                  "px-1.5 rounded-full text-[10.5px]",
                  tab === t.v ? "bg-white/20" : "bg-[color:var(--color-surface-muted)]",
                )}>
                  {(stats[t.badgeKey] as number).toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </div>

        <Input placeholder="Search by body, author, or post id…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="space-y-3">
        {!loading && data?.items.length === 0 && (
          <Card>
            <CardBody className="text-center py-16 text-[color:var(--color-text-subtle)] text-[13.5px]">
              {q ? "No posts match your search." : "Nothing in this bucket yet."}
            </CardBody>
          </Card>
        )}
        {data?.items.map((p) => (
          <PostCard key={p.id} post={p} onChange={() => { load(); loadStats(); }} />
        ))}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-[13px]">
          <p className="text-[color:var(--color-text-muted)]">
            Page {page} of {data.totalPages} · {data.total.toLocaleString()} total
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= data.totalPages} onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Post card ───────────────────────────────────────────────── */

function PostCard({ post, onChange }: { post: Post; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removeReason, setRemoveReason] = useState("");

  const call = async (action: string, reason?: string) => {
    setBusy(action);
    try {
      await fetch(`/api/admin/posts/${post.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      onChange();
    } finally {
      setBusy(null);
      setConfirmingRemove(false);
      setRemoveReason("");
    }
  };

  const removed = post.status === "REMOVED";

  return (
    <Card>
      <CardBody className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Avatar url={post.authorAvatar} name={post.authorName} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-[14px] truncate">
                {post.isAnonymous ? "Anonymous member" : post.authorName}
              </p>
              {post.isAnonymous && (
                <span className="text-[10.5px] uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)] font-semibold px-1.5 py-0.5 rounded-full bg-[color:var(--color-surface-hover)]">
                  Anon
                </span>
              )}
              <StatusChip status={post.status} />
              {post.reportCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)] border border-[color:var(--color-warning-soft)] text-[10.5px] font-medium">
                  {post.reportCount} report{post.reportCount === 1 ? "" : "s"}
                </span>
              )}
              {post.isFeatured && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] text-[10.5px] font-medium">
                  Featured
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-[color:var(--color-text-subtle)] mt-0.5">
              {post.isAnonymous ? `${post.authorName} · ` : ""}
              {post.authorEmail ?? "unknown@—"} · {relativeTime(post.createdAt)}
              {post.countryName && ` · ${post.countryName}`}
            </p>
          </div>
        </div>

        <p className="mt-3 text-[14px] leading-relaxed whitespace-pre-wrap break-words">
          {post.body}
        </p>

        {post.video && (
          <div className="mt-3 max-w-md">
            <VideoPlayer
              src={post.video.url}
              poster={post.video.posterUrl}
              width={post.video.width}
              height={post.video.height}
            />
          </div>
        )}

        {post.images.length > 0 && (
          <div className="mt-3">
            <PostImages
              images={post.images}
              limit={6}
              thumbHeightClass="h-32"
              singleMaxHClass="max-h-80"
            />
          </div>
        )}

        {removed && post.removedReason && (
          <div className="mt-3 rounded-[10px] bg-[color:var(--color-danger-soft)] border border-[color:var(--color-danger-soft)] text-[color:var(--color-danger)] text-[12.5px] px-3 py-2">
            <strong>Removed:</strong> {post.removedReason}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-4 text-[12px] text-[color:var(--color-text-muted)]">
            <span>♥ {post.likeCount}</span>
            <span>💬 {post.commentCount}</span>
            <span>🔖 {post.saveCount}</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            <Link href={`/admin/posts/${post.id}`}>
              <Button size="sm" variant="secondary">Open</Button>
            </Link>
            {!removed && (
              <Button
                size="sm"
                variant={post.isFeatured ? "secondary" : "ghost"}
                loading={busy === (post.isFeatured ? "unfeature" : "feature")}
                onClick={() => call(post.isFeatured ? "unfeature" : "feature")}
              >
                {post.isFeatured ? "Unfeature" : "Feature"}
              </Button>
            )}
            {removed ? (
              <Button size="sm" loading={busy === "restore"} onClick={() => call("restore")}>
                Restore
              </Button>
            ) : (
              <Button size="sm" variant="danger" onClick={() => setConfirmingRemove(true)}>
                Remove
              </Button>
            )}
          </div>
        </div>

        {confirmingRemove && (
          <div className="mt-3 rounded-[12px] bg-[color:var(--color-surface-muted)] border border-[color:var(--color-border)] p-3 space-y-2">
            <p className="text-[13px] font-medium">Remove this post?</p>
            <Input
              placeholder="Reason (shown to the author)"
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setConfirmingRemove(false);
                  setRemoveReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                className="flex-1"
                loading={busy === "remove"}
                onClick={() => call("remove", removeReason.trim() || undefined)}
              >
                Remove post
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ── Small building blocks ───────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value?: number;
  sub?: string | null;
  accent?: "warn";
}) {
  return (
    <Card>
      <CardBody className="px-4 py-3">
        <p className="text-[10.5px] uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)] font-semibold">
          {label}
        </p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className={cn(
            "text-[22px] font-semibold tabular-nums tracking-[-0.02em]",
            accent === "warn" && "text-[color:var(--color-warning)]",
          )}>
            {value ?? "—"}
          </p>
          {sub && <p className="text-[12px] text-[color:var(--color-text-muted)]">{sub}</p>}
        </div>
      </CardBody>
    </Card>
  );
}

function StatusChip({ status }: { status: Post["status"] }) {
  const map: Record<Post["status"], { label: string; cls: string }> = {
    PUBLISHED: { label: "Live",     cls: "bg-[color:var(--color-success-soft)] text-[color:var(--color-success-ink)] border-[color:var(--color-success-soft)]" },
    PENDING:   { label: "Pending",  cls: "bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)] border-[color:var(--color-warning-soft)]" },
    REMOVED:   { label: "Removed",  cls: "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)] border-[color:var(--color-danger-soft)]" },
    DRAFT:     { label: "Draft",    cls: "bg-[color:var(--color-surface-hover)] text-[color:var(--color-text-muted)] border-transparent" },
  };
  const c = map[status];
  return (
    <span className={cn("inline-flex px-2 py-0.5 rounded-full border text-[10.5px] font-medium", c.cls)}>
      {c.label}
    </span>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  const initials = useMemo(
    () =>
      name
        .split(/\s+/)
        .map((s) => s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    [name],
  );
  if (url) {
    return (
      <Img src={url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover bg-[color:var(--color-surface-muted)]"
        variant="thumb"
      />
    );
  }
  return (
    <div className="shrink-0 h-9 w-9 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] flex items-center justify-center text-[12.5px] font-semibold">
      {initials || "?"}
    </div>
  );
}

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
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
