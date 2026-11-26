"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type StatusFilter = "open" | "resolved" | "dismissed" | "all";

const REASON_LABELS: Record<string, { label: string; tone: "warn" | "danger" | "neutral" }> = {
  SPAM:           { label: "Spam",             tone: "neutral" },
  HARASSMENT:     { label: "Harassment",       tone: "danger" },
  HATE_SPEECH:    { label: "Hate speech",      tone: "danger" },
  SELF_HARM:      { label: "Self-harm",        tone: "danger" },
  ADULT_CONTENT:  { label: "Adult content",    tone: "warn" },
  MISINFORMATION: { label: "Misinformation",   tone: "warn" },
  OFF_TOPIC:      { label: "Off-topic",        tone: "neutral" },
  OTHER:          { label: "Other",            tone: "neutral" },
};

const REASONS = Object.keys(REASON_LABELS);

interface Report {
  id: string;
  targetType: "POST" | "COMMENT";
  postId: string;
  commentId: string | null;
  reporterName: string | null;
  reason: string;
  notes: string | null;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  resolvedByName: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
  targetPreview: string;
  targetAuthorName: string;
}

interface Stats {
  postsTotal: number;
  postsPublished: number;
  postsRemoved: number;
  commentsTotal: number;
  reportsOpen: number;
  reportsResolvedLast7d: number;
}

/**
 * Dedicated reports queue — same triage actions as the inline block
 * used to have, but standalone so a moderator can bookmark it and
 * live there. Includes the parent reason filter + pagination + live
 * open-count in the header.
 */
export function ReportsClient() {
  const [status, setStatus] = useState<StatusFilter>("open");
  const [reason, setReason] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    items: Report[];
    total: number;
    totalPages: number;
  } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      status,
      page: String(page),
      perPage: "25",
    });
    if (reason !== "all") params.set("reason", reason);
    const res = await fetch(`/api/admin/posts/reports?${params}`);
    const d = await res.json().catch(() => null);
    setData(d);
    setLoading(false);
  }, [status, reason, page]);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/admin/posts/stats");
    if (res.ok) setStats(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    setPage(1);
  }, [status, reason]);

  // Refresh both list + stats when the tab regains focus. Cheap way
  // to keep the badge in sync with what the mod is looking at.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        load();
        loadStats();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load, loadStats]);

  const pushToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="text-[12.5px] mb-2">
            <Link
              href="/admin/posts"
              className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
            >
              ← Back to feed
            </Link>
          </div>
          <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em]">
            Reports queue
          </h1>
          <p className="mt-1 text-[14px] text-[color:var(--color-text-muted)]">
            {stats?.reportsOpen === 0
              ? "All clear. New reports show up here automatically."
              : "Triage each one — remove, keep, or dismiss."}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Open"
          value={stats?.reportsOpen}
          accent={stats && stats.reportsOpen > 0 ? "warn" : undefined}
        />
        <StatCard label="Resolved (7d)" value={stats?.reportsResolvedLast7d} />
        <StatCard label="Removed posts" value={stats?.postsRemoved} />
        <StatCard
          label="Total posts"
          value={stats?.postsTotal}
          sub={stats && `${stats.postsPublished} live`}
        />
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {(["open", "resolved", "dismissed", "all"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 h-9 rounded-full text-[12.5px] font-medium border transition-colors",
                status === s
                  ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)] border-transparent"
                  : "bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] border-[color:var(--color-border)] hover:text-[color:var(--color-text)]",
              )}
            >
              {s[0]!.toUpperCase()}{s.slice(1)}
              {s === "open" && stats && stats.reportsOpen > 0 && (
                <span
                  className={cn(
                    "px-1.5 rounded-full text-[10.5px] tabular-nums",
                    status === s ? "bg-white/20" : "bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)]",
                  )}
                >
                  {stats.reportsOpen}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="md:ml-auto flex items-center gap-2">
          <label className="text-[12px] text-[color:var(--color-text-subtle)]">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-9 pl-3 pr-9 rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[13px] appearance-none focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)]"
          >
            <option value="all">All reasons</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {REASON_LABELS[r]!.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2.5">
        {!loading && data?.items.length === 0 && (
          <Card>
            <CardBody className="text-center py-16">
              <div className="mx-auto h-10 w-10 rounded-full bg-[color:var(--color-success-soft)] flex items-center justify-center text-[color:var(--color-success)] mb-3">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M5 10l3.5 3.5L15 6.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-[14px] font-medium">
                {status === "open" ? "You're all caught up." : "Nothing here."}
              </p>
              <p className="text-[12.5px] text-[color:var(--color-text-muted)] mt-0.5">
                {status === "open"
                  ? "New reports will pop up automatically."
                  : "Try a different filter above."}
              </p>
            </CardBody>
          </Card>
        )}
        {data?.items.map((r) => (
          <ReportCard
            key={r.id}
            report={r}
            onChange={() => {
              load();
              loadStats();
              pushToast("Report handled.");
            }}
          />
        ))}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-[13px]">
          <p className="text-[color:var(--color-text-muted)]">
            Page {page} of {data.totalPages} · {data.total.toLocaleString()} total
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-40 rounded-[12px] bg-[color:var(--color-success)] text-[color:var(--color-on-success)] px-4 py-3 shadow-[var(--shadow-elevated)] text-[13.5px]">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ── Report card ─────────────────────────────────────────────── */

function ReportCard({
  report,
  onChange,
}: {
  report: Report;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const conf = REASON_LABELS[report.reason] ?? { label: report.reason, tone: "neutral" as const };

  const call = async (outcome: "remove" | "keep" | "dismiss") => {
    setBusy(outcome);
    await fetch(`/api/admin/posts/reports/${report.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome, note: note.trim() || undefined }),
    });
    setBusy(null);
    setShowNote(false);
    setNote("");
    onChange();
  };

  return (
    <Card>
      <CardBody className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-medium border",
              conf.tone === "danger" && "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)] border-[color:var(--color-danger-soft)]",
              conf.tone === "warn"   && "bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)] border-[color:var(--color-warning-soft)]",
              conf.tone === "neutral"&& "bg-[color:var(--color-surface-hover)] text-[color:var(--color-text-muted)] border-transparent",
            )}
          >
            {conf.label}
          </span>
          <span className="text-[10.5px] uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)] font-semibold px-1.5 py-0.5 rounded-full bg-[color:var(--color-surface-hover)]">
            {report.targetType}
          </span>
          <p className="text-[11.5px] text-[color:var(--color-text-subtle)]">
            {report.reporterName ? `by ${report.reporterName}` : "anonymous reporter"} · {relativeTime(report.createdAt)}
          </p>
          {report.status !== "OPEN" && (
            <span
              className={cn(
                "ml-auto inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-medium border",
                report.status === "RESOLVED"
                  ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success-ink)] border-[color:var(--color-success-soft)]"
                  : "bg-[color:var(--color-surface-hover)] text-[color:var(--color-text-muted)] border-transparent",
              )}
            >
              {report.status === "RESOLVED" ? "Resolved" : "Dismissed"}
            </span>
          )}
        </div>

        <p className="text-[14px] leading-relaxed break-words whitespace-pre-wrap">
          <span className="text-[color:var(--color-text-muted)] font-medium">{report.targetAuthorName}: </span>
          {report.targetPreview}
        </p>

        {report.notes && (
          <p className="text-[12.5px] text-[color:var(--color-text-muted)] italic border-l-2 border-[color:var(--color-border)] pl-3">
            Reporter's note: "{report.notes}"
          </p>
        )}

        {report.status === "OPEN" ? (
          <>
            {showNote && (
              <Input
                placeholder="Note (optional — recorded in audit log)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                autoFocus
              />
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                href={`/admin/posts/${report.postId}`}
                className="min-h-9 px-3 text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline inline-flex items-center"
              >
                Open post →
              </Link>
              <button
                type="button"
                onClick={() => setShowNote((v) => !v)}
                className="min-h-9 px-3 text-[12.5px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
              >
                {showNote ? "Hide note" : "Add note"}
              </button>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="ghost"
                loading={busy === "dismiss"}
                onClick={() => call("dismiss")}
              >
                Dismiss
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={busy === "keep"}
                onClick={() => call("keep")}
              >
                Keep
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={busy === "remove"}
                onClick={() => call("remove")}
              >
                Remove
              </Button>
            </div>
          </>
        ) : (
          <p className="text-[11.5px] text-[color:var(--color-text-subtle)]">
            {report.resolvedByName && `${report.resolvedByName} · `}
            {report.resolvedAt && relativeTime(report.resolvedAt)}
            {report.resolution && ` · "${report.resolution}"`}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

/* ── Small primitives ────────────────────────────────────────── */

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
          <p
            className={cn(
              "text-[22px] font-semibold tabular-nums tracking-[-0.02em]",
              accent === "warn" && "text-[color:var(--color-warning)]",
            )}
          >
            {value ?? "—"}
          </p>
          {sub && (
            <p className="text-[12px] text-[color:var(--color-text-muted)]">
              {sub}
            </p>
          )}
        </div>
      </CardBody>
    </Card>
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
