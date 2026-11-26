"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatEventTime } from "@/lib/timezone";
import { Img } from "@/components/ui/img";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

interface Row {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  isOnline: boolean;
  venueName: string | null;
  city: string | null;
  capacity: number | null;
  rsvpCount: number;
  status: Status;
  hostNameSnapshot: string;
  rejectionReason: string | null;
  chatRoomId: string | null;
}

const STATUS_STYLE: Record<Status, string> = {
  PENDING: "bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)]",
  APPROVED: "bg-[color:var(--color-success)]/12 text-[color:var(--color-success)]",
  REJECTED: "bg-[color:var(--color-danger)]/12 text-[color:var(--color-danger)]",
  CANCELLED: "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-subtle)]",
};

export function AdminEventsClient() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pending, setPending] = useState(0);
  const [status, setStatus] = useState<Status | "ALL">("PENDING");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ status, perPage: "50" });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/admin/events?${params}`);
    const d = (await res.json().catch(() => ({ events: [], total: 0, pendingCount: 0 }))) as {
      events: Row[];
      total: number;
      pendingCount: number;
    };
    setRows(d.events);
    setTotal(d.total);
    setPending(d.pendingCount);
  }, [status, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (id: string, action: "approve" | "reject" | "cancel") => {
    let reason: string | undefined;
    if (action === "reject") {
      const r = window.prompt("Why is this being rejected? (shown to the organiser)");
      if (r === null) return;
      reason = r;
    }
    if (action === "cancel" && !window.confirm("Cancel this event? Everyone who RSVP'd is notified.")) return;
    setBusy(id);
    await fetch(`/api/admin/events/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    setBusy(null);
    void load();
  };

  const remove = async (id: string, title: string) => {
    if (!window.confirm(`Delete “${title}”? RSVPs go with it. The chatroom stays.`)) return;
    setBusy(id);
    await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
    setBusy(null);
    void load();
  };

  const when = (r: Row) =>
    `${formatEventTime(r.startsAt, r.timezone, { withZone: true })}${
      r.endsAt ? ` → ${formatEventTime(r.endsAt, r.timezone)}` : ""
    }`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Events</h1>
          <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
            {total} in this view
            {pending > 0 && ` · ${pending} waiting for review`}
          </p>
        </div>
        <Link href="/admin/events/new">
          <Button size="sm">New event</Button>
        </Link>
      </div>

      <Card>
        <CardBody className="p-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-[180px] flex-1">
              <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">Search</span>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title, city or venue" />
            </label>
            <label className="block w-44">
              <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status | "ALL")}
                className="h-10 w-full rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[14px]"
              >
                <option value="PENDING">Waiting for review{pending ? ` (${pending})` : ""}</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="ALL">All</option>
              </select>
            </label>
          </div>
        </CardBody>
      </Card>

      {rows === null ? (
        <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardBody>
            <p className="py-6 text-center text-[14px] text-[color:var(--color-text-muted)]">
              {status === "PENDING" ? "Nothing waiting for review." : "No events here."}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardBody className="flex gap-3 p-3">
                <div className="h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-[color:var(--color-surface-muted)]">
                  {r.coverUrl ? (
                    <Img src={r.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-[color:var(--color-text-subtle)]">
                      No cover
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_STYLE[r.status]}`}>
                      {r.status === "PENDING" ? "WAITING" : r.status}
                    </span>
                    {r.isOnline && (
                      <span className="rounded-full bg-[color:var(--color-surface-muted)] px-2 py-0.5 text-[10.5px] font-semibold text-[color:var(--color-text-muted)]">
                        ONLINE
                      </span>
                    )}
                  </div>

                  <p className="mt-1 truncate text-[14.5px] font-semibold tracking-[-0.01em]">{r.title}</p>
                  <p className="mt-0.5 text-[11.5px] text-[color:var(--color-text-subtle)]">{when(r)}</p>
                  <p className="text-[11.5px] tabular-nums text-[color:var(--color-text-subtle)]">
                    {r.isOnline ? "Online" : [r.venueName, r.city].filter(Boolean).join(" · ") || "No venue"}
                    {" · "}
                    {r.rsvpCount}
                    {r.capacity ? `/${r.capacity}` : ""} going · by {r.hostNameSnapshot}
                  </p>
                  {r.status === "REJECTED" && r.rejectionReason && (
                    <p className="mt-1 text-[11.5px] text-[color:var(--color-danger)]">
                      Reason: {r.rejectionReason}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {r.status === "PENDING" && (
                      <>
                        <button
                          type="button"
                          disabled={busy === r.id}
                          onClick={() => review(r.id, "approve")}
                          className="text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy === r.id}
                          onClick={() => review(r.id, "reject")}
                          className="text-[12.5px] font-medium text-[color:var(--color-danger)] hover:underline"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <Link
                      href={`/admin/events/${r.id}`}
                      className="text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline"
                    >
                      Edit
                    </Link>
                    {r.status === "APPROVED" && (
                      <>
                        <a
                          href={`/events/${r.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12.5px] font-medium text-[color:var(--color-text-muted)] hover:underline"
                        >
                          View
                        </a>
                        <button
                          type="button"
                          disabled={busy === r.id}
                          onClick={() => review(r.id, "cancel")}
                          className="text-[12.5px] font-medium text-[color:var(--color-text-muted)] hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={busy === r.id}
                      onClick={() => remove(r.id, r.title)}
                      className="text-[12.5px] font-medium text-[color:var(--color-danger)] hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
