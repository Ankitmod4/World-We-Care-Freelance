"use client";

/**
 * Broadcast moderation.
 *
 * Anyone can go live, which makes this page the counterweight: what is
 * on air right now, one click to pull it, and one click to stop a
 * member going live again. There is deliberately no way to watch a
 * stream from here — a moderator who needs to see one opens the public
 * watch page like everybody else, and that leaves the same trace.
 *
 * Laid out like every other admin list (Places, Posts, Library): a
 * heading with a live count, a row of filter chips, then a single card
 * holding a divided list.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Img } from "@/components/ui/img";

interface Row {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  status: "IDLE" | "LIVE" | "ENDED";
  visibility: "PUBLIC" | "UNLISTED";
  ownerUserId: string | null;
  ownerName: string;
  ownerAvatar: string | null;
  startedAt: string | null;
  endedAt: string | null;
  endedBy: string | null;
  endReason: string | null;
  viewerCount: number;
  viewerPeak: number;
  viewCount: number;
  recording: boolean;
  path: string;
  ownerCanStream: boolean;
}

const FILTERS = ["ALL", "LIVE", "IDLE", "ENDED"] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_LABEL: Record<Filter, string> = {
  ALL: "All",
  LIVE: "On air",
  IDLE: "Not started",
  ENDED: "Ended",
};

const STATUS_TONE: Record<Row["status"], string> = {
  LIVE: "bg-[color:var(--color-danger)]/12 text-[color:var(--color-danger)]",
  IDLE: "bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-ink)]",
  ENDED: "bg-[color:var(--color-surface-hover)] text-[color:var(--color-text-muted)]",
};

export function LiveAdmin() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sp = new URLSearchParams();
    if (filter !== "ALL") sp.set("status", filter);
    if (q.trim()) sp.set("q", q.trim());
    const res = await fetch(`/api/admin/live?${sp}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) { setRows([]); return; }
    const d = (await res.json()) as { streams: Row[] };
    setRows(d.streams ?? []);
  }, [filter, q]);

  // Debounced, so typing in the search box doesn't fire a request per
  // keystroke — same as the other admin lists.
  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // Something on air changes fast; a stale list is the wrong thing to
  // moderate from.
  useEffect(() => {
    const timer = setInterval(load, 20_000);
    return () => clearInterval(timer);
  }, [load]);

  const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 3000); };
  const onAir = (rows ?? []).filter((r) => r.status === "LIVE").length;

  const endStream = async (r: Row) => {
    const reason = window.prompt(`End "${r.title}"? The reason is kept on the record.`, "");
    if (reason === null) return;
    setBusyId(r.id);
    setError(null);
    const res = await fetch(`/api/admin/live/${r.id}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }).catch(() => null);
    setBusyId(null);
    if (!res?.ok) { setError("Couldn't end that broadcast."); return; }
    say("Broadcast ended.");
    await load();
  };

  const setOwner = async (r: Row, allowed: boolean) => {
    if (!r.ownerUserId) return;
    if (
      !allowed &&
      !window.confirm(
        `Stop ${r.ownerName} going live? Anything they have on air right now ends immediately.`,
      )
    ) {
      return;
    }
    setBusyId(r.id);
    const res = await fetch(`/api/admin/live/owner/${r.ownerUserId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowed }),
    }).catch(() => null);
    setBusyId(null);
    if (!res?.ok) { setError("Couldn't change that."); return; }
    const d = (await res.json()) as { ended: number };
    say(
      allowed
        ? `${r.ownerName} can go live again.`
        : `${r.ownerName} is blocked${d.ended ? `, and ${d.ended} broadcast${d.ended === 1 ? "" : "s"} ended` : ""}.`,
    );
    await load();
  };

  const chip = (active: boolean) =>
    `inline-flex min-h-9 items-center rounded-full border px-3.5 text-[12.5px] font-medium transition-colors duration-200 ${
      active
        ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
        : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-brand)]"
    }`;

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]">
            Live broadcasts
          </h1>
          <p className="mt-0.5 max-w-[72ch] text-[13px] text-[color:var(--color-text-muted)]">
            Anyone can go live, so this is where you see what is on air and stop it if you
            need to.
            {onAir > 0 && (
              <span className="ml-1 font-medium text-[color:var(--color-danger)]">
                {onAir} on air now.
              </span>
            )}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={chip(filter === f)}>
            {FILTER_LABEL[f]}
            {f === "LIVE" && onAir > 0 ? ` · ${onAir}` : ""}
          </button>
        ))}
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title or broadcaster…"
          className="h-9 max-w-[260px] text-[13px]"
        />
      </div>

      {error && (
        <p className="rounded-xl bg-[color:var(--color-danger)]/10 px-3 py-2 text-[13px] text-[color:var(--color-danger)]">
          {error}
        </p>
      )}
      {flash && (
        <p className="rounded-xl bg-[color:var(--color-brand-soft)] px-3 py-2 text-[13px] text-[color:var(--color-brand-ink)]">
          {flash}
        </p>
      )}

      {rows === null ? (
        <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardBody className="p-10 text-center">
            <p className="text-[15px] font-medium">
              {filter === "LIVE" ? "Nobody is live right now" : "Nothing here"}
            </p>
            <p className="mx-auto mt-1 max-w-[46ch] text-[13.5px] text-[color:var(--color-text-muted)]">
              {q.trim()
                ? "No broadcasts match that search."
                : filter === "ALL"
                  ? "Broadcasts appear here as soon as a member sets one up."
                  : "No broadcasts with that status."}
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-[color:var(--color-border-soft)]">
              {rows.map((r) => (
                <li key={r.id} className="p-3 sm:px-5">
                  <div className="flex items-start gap-3">
                    <Avatar name={r.ownerName} url={r.ownerAvatar} live={r.status === "LIVE"} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/live/${r.slug}`}
                          target="_blank"
                          className="text-[14.5px] font-semibold hover:text-[color:var(--color-brand)]"
                        >
                          {r.title}
                        </Link>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${STATUS_TONE[r.status]}`}
                        >
                          {r.status === "LIVE" ? "On air" : r.status}
                        </span>
                        {r.visibility === "UNLISTED" && (
                          <span className="rounded-full bg-[color:var(--color-surface-hover)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
                            Unlisted
                          </span>
                        )}
                        {r.recording && (
                          <span className="rounded-full bg-[color:var(--color-danger)]/12 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--color-danger)]">
                            Recording
                          </span>
                        )}
                        {!r.ownerCanStream && (
                          <span className="rounded-full bg-[color:var(--color-warning-soft)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--color-warning-ink)]">
                            Blocked
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-muted)]">
                        {r.ownerUserId ? (
                          <Link
                            href={`/admin/users/${r.ownerUserId}`}
                            className="hover:text-[color:var(--color-brand)]"
                          >
                            {r.ownerName}
                          </Link>
                        ) : (
                          r.ownerName
                        )}
                        {r.startedAt ? ` · started ${fmt(r.startedAt)}` : ""}
                      </p>

                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] tabular-nums text-[color:var(--color-text-subtle)]">
                        {r.status === "LIVE" ? (
                          <span className="font-medium text-[color:var(--color-danger)]">
                            {r.viewerCount} watching
                          </span>
                        ) : (
                          <span>
                            {r.viewCount} view{r.viewCount === 1 ? "" : "s"}
                          </span>
                        )}
                        <span>· peak {r.viewerPeak}</span>
                        <span className="font-mono">· {r.path}</span>
                      </p>

                      {r.endedBy && (
                        <p className="mt-1 text-[12px] text-[color:var(--color-text-subtle)]">
                          Ended by {r.endedBy.toLowerCase()}
                          {r.endReason ? ` — ${r.endReason}` : ""}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {r.status !== "ENDED" && (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busyId === r.id}
                          onClick={() => void endStream(r)}
                        >
                          End now
                        </Button>
                      )}
                      {r.ownerUserId && (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void setOwner(r, !r.ownerCanStream)}
                          className="text-[11.5px] font-medium text-[color:var(--color-brand)] hover:underline disabled:opacity-50"
                        >
                          {r.ownerCanStream ? "Block broadcaster" : "Unblock broadcaster"}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/**
 * The broadcaster's face, ringed in red while they're on air.
 *
 * The other admin lists lead each row with a thumbnail; a broadcast
 * has no cover image, so the person is the thing worth showing — it
 * is also who a moderator is deciding about.
 */
function Avatar({ name, url, live }: { name: string; url: string | null; live: boolean }) {
  const ring = live ? "ring-2 ring-[color:var(--color-danger)] ring-offset-2" : "";
  if (url) {
    return (
      <Img
        src={url}
        alt=""
        variant="thumb"
        className={`h-12 w-12 shrink-0 rounded-[10px] object-cover ${ring}`}
      />
    );
  }
  return (
    <span
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-[color:var(--color-surface-muted)] text-[17px] font-semibold text-[color:var(--color-text-muted)] ${ring}`}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
