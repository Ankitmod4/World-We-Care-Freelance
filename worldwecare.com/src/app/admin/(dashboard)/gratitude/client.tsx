"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Img } from "@/components/ui/img";
import { VideoPlayer } from "@/components/ui/video-player";
import type { AttachedVideo } from "@/lib/attached-media";

type Status = "PENDING" | "APPROVED" | "REJECTED";

interface Item {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  isAnonymous: boolean;
  body: string;
  status: Status;
  rejectionReason: string | null;
  heartCount: number;
  createdAt: string;
  reviewedAt: string | null;
  imageUrl: string | null;
  video: AttachedVideo | null;
}

const TABS: Array<{ key: Status | "ALL"; label: string }> = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
];

export function GratitudeAdminClient() {
  const [tab, setTab] = useState<Status | "ALL">("PENDING");
  const [items, setItems] = useState<Item[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Item | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async (status: Status | "ALL") => {
    setItems(null);
    const res = await fetch(`/api/admin/gratitude?status=${status}`);
    const d = await res.json().catch(() => ({ items: [] }));
    setItems(d.items ?? []);
    setCursor(d.nextCursor ?? null);
    if (typeof d.pendingCount === "number") setPendingCount(d.pendingCount);
  }, []);

  useEffect(() => { void load(tab); }, [tab, load]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/admin/gratitude?status=${tab}&cursor=${encodeURIComponent(cursor)}`);
      const d = await res.json();
      setItems((prev) => [...(prev ?? []), ...(d.items ?? [])]);
      setCursor(d.nextCursor ?? null);
    } finally {
      setLoadingMore(false);
    }
  };

  const applyResult = (item: Item) => {
    setItems((prev) => {
      if (!prev) return prev;
      // Drop it from the list if it no longer matches the active filter.
      if (tab !== "ALL" && item.status !== tab) return prev.filter((i) => i.id !== item.id);
      return prev.map((i) => (i.id === item.id ? item : i));
    });
  };

  const moderate = async (item: Item, action: "approve" | "reject", reason?: string) => {
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/admin/gratitude/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.item) {
        applyResult(d.item as Item);
        setPendingCount((c) => {
          const wasPending = item.status === "PENDING";
          const nowPending = (d.item as Item).status === "PENDING";
          return Math.max(0, c + (wasPending ? -1 : 0) + (nowPending ? 1 : 0));
        });
      }
    } finally {
      setBusyId(null);
    }
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    await moderate(rejectTarget, "reject", rejectReason);
    setRejectTarget(null);
    setRejectReason("");
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Gratitude wall</h1>
        <p className="text-[13px] text-[color:var(--color-text-muted)] mt-0.5">
          Approve or reject gratitude posts before they appear on the public wall. The author is notified of every decision.
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[13px] font-medium transition-colors " +
              (tab === t.key
                ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
                : "bg-[color:var(--color-surface)] border border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-hover)]")
            }
          >
            {t.label}
            {t.key === "PENDING" && pendingCount > 0 && (
              <span className={"min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-semibold " + (tab === "PENDING" ? "bg-[color:var(--color-on-brand)]/25 text-[color:var(--color-on-brand)]" : "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]")}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {items === null ? (
        <p className="text-[13px] text-[color:var(--color-text-muted)] py-8 text-center">Loading…</p>
      ) : items.length === 0 ? (
        <Card><CardBody className="p-10 text-center">
          <p className="text-[14px] font-medium">Nothing here</p>
          <p className="text-[12.5px] text-[color:var(--color-text-muted)] mt-0.5">
            {tab === "PENDING" ? "No posts waiting for review." : "No entries in this view."}
          </p>
        </CardBody></Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardBody className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13.5px] font-semibold truncate">{item.authorName}</span>
                    {item.isAnonymous && (
                      <span className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-muted)]">shown anonymously</span>
                    )}
                    <StatusBadge status={item.status} />
                  </div>
                  <span className="text-[11.5px] text-[color:var(--color-text-subtle)] shrink-0">{new Date(item.createdAt).toLocaleString()}</span>
                </div>

                <p className="mt-2.5 text-[14px] leading-relaxed whitespace-pre-wrap text-[color:var(--color-text)]">{item.body}</p>
                {item.imageUrl && (
                  <Img src={item.imageUrl} alt="" className="mt-2.5 max-h-64 rounded-[10px] border border-[color:var(--color-border)] object-cover" />
                )}
                {/*
                  THE MODERATOR HAS TO BE ABLE TO WATCH IT.

                  A reviewer who can read the text but not play the
                  video is approving something they have not seen — and
                  on these two walls the video is the part most likely
                  to be the reason to reject. Muted and not autoplaying:
                  a queue of thirty pending entries that all start
                  talking at once is unusable.

                  `maxHeight` matches the 256px cap on the photo above
                  so a video entry and a photo entry are the same size
                  in the list.
                */}
                {item.video && (
                  <div className="mt-2.5 max-w-lg">
                    <VideoPlayer
                      src={item.video.url}
                      poster={item.video.posterUrl}
                      width={item.video.width}
                      height={item.video.height}
                      maxHeight="256px"
                    />
                  </div>
                )}

                {item.status === "REJECTED" && item.rejectionReason && (
                  <p className="mt-2 text-[12.5px] text-[color:var(--color-danger)]">Reason: {item.rejectionReason}</p>
                )}

                <div className="mt-3 flex items-center gap-2">
                  {item.status !== "APPROVED" && (
                    <Button size="sm" loading={busyId === item.id} onClick={() => moderate(item, "approve")}>Approve</Button>
                  )}
                  {item.status !== "REJECTED" && (
                    <Button size="sm" variant="secondary" disabled={busyId === item.id} onClick={() => { setRejectTarget(item); setRejectReason(""); }}>
                      Reject
                    </Button>
                  )}
                  <span className="ml-auto text-[11.5px] text-[color:var(--color-text-subtle)]">{item.heartCount} ♥</span>
                </div>
              </CardBody>
            </Card>
          ))}

          {cursor && (
            <div className="flex justify-center pt-1">
              <button onClick={loadMore} disabled={loadingMore} className="min-h-10 px-5 rounded-[12px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] text-[13px] font-medium text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-hover)] disabled:opacity-50">
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRejectTarget(null)} />
          <div className="relative w-full sm:max-w-md bg-[color:var(--color-surface)] rounded-t-2xl sm:rounded-2xl border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)] p-5">
            <h2 className="text-[16px] font-semibold tracking-[-0.01em]">Reject this post?</h2>
            <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
              The author will be notified. Add an optional reason they'll see.
            </p>
            <div className="mt-3">
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="Reason (optional) — e.g. contains spam / promotional content" />
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setRejectTarget(null)} disabled={busyId === rejectTarget.id}>Cancel</Button>
              <Button variant="danger" loading={busyId === rejectTarget.id} onClick={submitReject}>Reject</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    PENDING: "bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)]",
    APPROVED: "bg-[color:var(--color-success-soft)] text-[color:var(--color-success-ink)]",
    REJECTED: "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger-ink)]",
  };
  return (
    <span className={"text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full " + map[status]}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
