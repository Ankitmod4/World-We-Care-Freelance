"use client";

/**
 * The directory's admin list, which doubles as the review queue.
 *
 * Pending submissions sort first and carry their own approve/reject
 * controls inline — a separate queue page would mean checking two
 * screens to do one job.
 *
 * The geocode state is surfaced on every row. A place with no
 * coordinates is invisible on the map, and the only thing worse than
 * that is not being told.
 *
 * Member reports live in a panel at the top rather than a page of their
 * own, for the same reason the review queue does: the fix for "this has
 * closed" is on this screen, and a queue you have to navigate to is a
 * queue nobody reads. `?reports=1` opens it — that is where the admin
 * notification points.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PLACE_TYPES, placeTypeEmoji, placeTypeLabel } from "@/lib/places";
import { reportKindLabel } from "@/lib/place-report-kinds";
import { Img } from "@/components/ui/img";

interface Row {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CLOSED";
  city: string | null;
  addressLine: string | null;
  latitude: number | null;
  longitude: number | null;
  geocodeError: string | null;
  isDonor: boolean;
  coverUrl: string | null;
  saveCount: number;
  submitterSnapshot: string | null;
  updatedAt: string;
}

const STATUS_TONE: Record<string, string> = {
  APPROVED: "bg-[color:var(--color-success)]/12 text-[color:var(--color-success)]",
  PENDING: "bg-[color:var(--color-warning)]/12 text-[color:var(--color-warning)]",
  REJECTED: "bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]",
  CLOSED: "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-muted)]",
};

interface ReportRow {
  id: string;
  kind: string;
  notes: string | null;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  reporterSnapshot: string | null;
  createdAt: string;
  place: { id: string; slug: string; name: string; city: string | null; status: string };
}

const STATUSES = ["ALL", "PENDING", "APPROVED", "REJECTED", "CLOSED"] as const;

/** Pinned, so a server in one timezone and an admin in another read the
 *  same date — the habit that stopped the campaign page hydrating wrong. */
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

export function PlacesClient() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL");
  const [type, setType] = useState("ALL");
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ items: Row[]; total: number; pending: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const [reports, setReports] = useState<ReportRow[] | null>(null);
  const [openReports, setOpenReports] = useState(0);
  const [reportsShown, setReportsShown] = useState(false);
  // Open the panel once, on the first load that finds something in it —
  // not after every resolve, which would fight the admin closing it.
  const firstReportLoad = useRef(true);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ status, type, perPage: "50" });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/admin/places?${params}`, { cache: "no-store" });
    if (!res.ok) {
      setError("Could not load places.");
      return;
    }
    setData(await res.json());
  }, [status, type, q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const loadReports = useCallback(async () => {
    const res = await fetch("/api/admin/places/reports?status=OPEN", { cache: "no-store" });
    if (!res.ok) return;
    const d = (await res.json()) as { reports: ReportRow[]; open: number };
    setReports(d.reports ?? []);
    setOpenReports(d.open ?? 0);
    if (firstReportLoad.current) {
      firstReportLoad.current = false;
      if ((d.open ?? 0) > 0) setReportsShown(true);
    }
  }, []);

  useEffect(() => {
    void loadReports();
    // The admin notification links here with ?reports=1. Read it off the
    // URL rather than through useSearchParams, which would want a
    // Suspense boundary this page has no other use for.
    if (typeof window !== "undefined" && window.location.search.includes("reports=1")) {
      setReportsShown(true);
    }
  }, [loadReports]);

  const actOnReport = async (id: string, action: "resolve" | "dismiss") => {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/admin/places/reports/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Could not update that report.");
      return;
    }
    await Promise.all([loadReports(), load()]);
  };

  const review = async (id: string, action: "approve" | "reject") => {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/admin/places/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: note[id] }),
    });
    setBusy(null);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Review failed.");
      return;
    }
    await load();
  };

  const regeocode = async (id: string) => {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/admin/places/${id}/geocode`, { method: "POST" });
    const d = (await res.json().catch(() => ({}))) as { geocodeError?: string | null };
    setBusy(null);
    if (d.geocodeError) setError(d.geocodeError);
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
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]">Places</h1>
          <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
            The map and directory. Members can submit places; they wait here for review.
            {data && data.pending > 0 && (
              <span className="ml-1 font-medium text-[color:var(--color-warning)]">
                {data.pending} waiting.
              </span>
            )}
          </p>
        </div>
        <Link href="/admin/places/new">
          <Button size="sm">New place</Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} className={chip(status === s)}>
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            {s === "PENDING" && data && data.pending > 0 ? ` · ${data.pending}` : ""}
          </button>
        ))}
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-9 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[12.5px]"
        >
          <option value="ALL">Every type</option>
          {PLACE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
          ))}
        </select>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, city or address…"
          className="h-9 max-w-[260px] text-[13px]"
        />
        <button
          type="button"
          onClick={() => setReportsShown((v) => !v)}
          className={chip(reportsShown)}
        >
          Reports{openReports > 0 ? ` · ${openReports}` : ""}
        </button>
      </div>

      {error && (
        <p className="rounded-xl bg-[color:var(--color-danger)]/10 px-3 py-2 text-[13px] text-[color:var(--color-danger)]">
          {error}
        </p>
      )}

      {/* ── member reports ───────────────────────────────── */}
      {(openReports > 0 || reportsShown) && (
        <Card>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
                  Reported by members
                  {openReports > 0 && (
                    <span className="ml-2 rounded-full bg-[color:var(--color-danger)]/10 px-2 py-0.5 text-[12px] font-semibold text-[color:var(--color-danger)]">
                      {openReports}
                    </span>
                  )}
                </h2>
                <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-muted)]">
                  Someone walked to the door and found it wrong. Fix the listing, then resolve.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportsShown((v) => !v)}
                className="text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline"
              >
                {reportsShown ? "Hide" : "Show"}
              </button>
            </div>

            {reportsShown &&
              (reports === null ? (
                <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>
              ) : reports.length === 0 ? (
                <p className="text-[13px] text-[color:var(--color-text-subtle)]">
                  Nothing open. The last person to check found everything where it should be.
                </p>
              ) : (
                <ul className="space-y-2">
                  {reports.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-xl border border-[color:var(--color-border-soft)] p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-semibold">
                            <Link
                              href={`/admin/places/${r.place.id}`}
                              className="hover:text-[color:var(--color-brand)]"
                            >
                              {r.place.name}
                            </Link>
                            {r.place.city ? (
                              <span className="font-normal text-[color:var(--color-text-muted)]">
                                {" "}
                                · {r.place.city}
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 text-[12.5px]">
                            <span className="font-medium text-[color:var(--color-danger)]">
                              {reportKindLabel(r.kind)}
                            </span>
                            <span className="text-[color:var(--color-text-subtle)]">
                              {" "}
                              · {r.reporterSnapshot ?? "A member"} · {shortDate(r.createdAt)}
                            </span>
                          </p>
                          {r.notes && (
                            <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-[color:var(--color-text-muted)]">
                              {r.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy === r.id}
                            onClick={() => void actOnReport(r.id, "dismiss")}
                          >
                            Dismiss
                          </Button>
                          <Button
                            size="sm"
                            disabled={busy === r.id}
                            onClick={() => void actOnReport(r.id, "resolve")}
                          >
                            Resolved
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ))}
          </CardBody>
        </Card>
      )}

      {!data ? (
        <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>
      ) : data.items.length === 0 ? (
        <Card>
          <CardBody className="p-10 text-center">
            <p className="text-[15px] font-medium">Nothing here</p>
            <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">
              {status === "ALL"
                ? "Add the first place, or wait for a member to submit one."
                : "No places with that status."}
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-[color:var(--color-border-soft)]">
              {data.items.map((p) => {
                const mapped = p.latitude !== null && p.longitude !== null;
                return (
                  <li key={p.id} className="p-3 sm:px-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[color:var(--color-surface-muted)] text-[20px]">
                        {p.coverUrl ? (
                          <Img src={p.coverUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          placeTypeEmoji(p.type)
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/admin/places/${p.id}`}
                            className="text-[14.5px] font-semibold hover:text-[color:var(--color-brand)]"
                          >
                            {p.name}
                          </Link>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${
                              STATUS_TONE[p.status]
                            }`}
                          >
                            {p.status}
                          </span>
                          {p.isDonor && (
                            <span className="rounded-full bg-[color:var(--color-success)]/12 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--color-success)]">
                              Donor
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-muted)]">
                          {placeTypeLabel(p.type)}
                          {p.city ? ` · ${p.city}` : ""}
                          {p.addressLine ? ` · ${p.addressLine}` : ""}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] tabular-nums text-[color:var(--color-text-subtle)]">
                          {mapped ? (
                            <span>
                              📍 {p.latitude!.toFixed(4)}, {p.longitude!.toFixed(4)}
                            </span>
                          ) : (
                            <span className="font-medium text-[color:var(--color-warning)]">
                              Not on the map{p.geocodeError ? ` — ${p.geocodeError}` : ""}
                            </span>
                          )}
                          <span>· {p.saveCount} saved</span>
                          {p.submitterSnapshot && <span>· from {p.submitterSnapshot}</span>}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <Link href={`/admin/places/${p.id}`}>
                          <Button variant="secondary" size="sm">Edit</Button>
                        </Link>
                        {!mapped && (
                          <button
                            type="button"
                            onClick={() => void regeocode(p.id)}
                            disabled={busy === p.id}
                            className="text-[11.5px] font-medium text-[color:var(--color-brand)] hover:underline disabled:opacity-50"
                          >
                            {busy === p.id ? "Looking up…" : "Retry lookup"}
                          </button>
                        )}
                      </div>
                    </div>

                    {p.status === "PENDING" && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-[color:var(--color-warning-soft)] p-2.5">
                        <Input
                          value={note[p.id] ?? ""}
                          onChange={(e) => setNote((n) => ({ ...n, [p.id]: e.target.value }))}
                          placeholder="Reason, if rejecting — the member sees it"
                          className="h-9 min-w-[220px] flex-1 bg-[color:var(--color-surface)] text-[13px]"
                        />
                        <Button
                          size="sm"
                          loading={busy === p.id}
                          onClick={() => void review(p.id, "approve")}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy === p.id}
                          onClick={() => void review(p.id, "reject")}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
