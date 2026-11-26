"use client";

/**
 * The petition moderation queue.
 *
 * REJECTING ASKS FOR A REASON, AND THE REASON REACHES THE PERSON.
 * Someone who spent an evening writing a petition and gets a silent
 * refusal learns nothing except that the platform is arbitrary — and
 * on a site whose whole premise is helping people take a first step,
 * that is an expensive lesson to teach.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "CLOSED";

/** The full row, fetched only when a reviewer opens one. */
interface FullPetition {
  body: string;
  summary: string | null;
  coverUrl: string | null;
  photos: { url: string; alt: string | null }[] | null;
  video: { url: string; posterUrl: string | null } | null;
}

interface Row {
  id: string;
  slug: string;
  title: string;
  target: string;
  status: Status;
  signatureCount: number;
  goal: number | null;
  creatorUserId: string | null;
  creatorNameSnapshot: string;
  createdAt: string;
  reviewedAt: string | null;
}

const FILTERS: { value: Status | "ALL"; label: string }[] = [
  { value: "PENDING", label: "Waiting" },
  { value: "APPROVED", label: "Live" },
  { value: "CLOSED", label: "Closed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

export function AdminPetitionsClient() {
  const [status, setStatus] = useState<Status | "ALL">("PENDING");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  /*
   * The review panel.
   *
   * A reviewer used to have the title, the addressee and a link that
   * 404s — `getPetitionBySlug` shows a PENDING petition to its author
   * and to nobody else, admins included. So approve and reject were
   * being pressed without the case, and now without the photos and
   * video either, which are the parts most likely to be the reason to
   * reject. Opened on demand: the list stays one query.
   */
  const [openId, setOpenId] = useState<string | null>(null);
  const [full, setFull] = useState<Record<string, FullPetition | "loading" | "error">>({});

  const toggle = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (full[id] && full[id] !== "error") return;

    setFull((f) => ({ ...f, [id]: "loading" }));
    const res = await fetch(`/api/admin/petitions/${id}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setFull((f) => ({ ...f, [id]: "error" }));
      return;
    }
    const d = (await res.json().catch(() => null)) as { petition?: FullPetition } | null;
    setFull((f) => ({ ...f, [id]: d?.petition ?? "error" }));
  };

  const load = useCallback(async () => {
    setRows(null);
    const res = await fetch(`/api/admin/petitions?status=${status}`, { cache: "no-store" }).catch(
      () => null,
    );
    const d = (await res?.json().catch(() => ({ petitions: [] }))) as { petitions?: Row[] };
    setRows(d.petitions ?? []);
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: "approve" | "reject" | "close") => {
    let reason: string | undefined;
    if (action === "reject") {
      const answer = window.prompt(
        "Why is this being rejected? The person who wrote it will see this.",
      );
      // Cancel means cancel. An empty string would send a rejection
      // with no explanation, which is the thing this prompt exists to
      // prevent.
      if (answer === null) return;
      reason = answer.trim() || undefined;
    }

    setBusy(id);
    await fetch(`/api/admin/petitions/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    }).catch(() => undefined);
    setBusy(null);
    void load();
  };

  return (
    <>
      <header className="mb-4">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Petitions</h1>
        <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
          Community-started petitions waiting for review.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatus(f.value)}
            className={`h-9 rounded-full px-4 text-[13px] font-medium transition-colors ${
              status === f.value
                ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
                : "border border-[color:var(--color-border-soft)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-brand)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows === null ? (
        <p className="text-[13.5px] text-[color:var(--color-text-muted)]">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center">
          <p className="text-[14px] font-medium">Nothing here</p>
          <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
            {status === "PENDING" ? "The queue is empty." : "No petitions with this status."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11.5px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
                    To {r.target}
                  </p>
                  <h2 className="mt-0.5 text-[15.5px] font-semibold leading-snug">
                    <Link href={`/petitions/${r.slug}`} className="hover:underline" target="_blank">
                      {r.title}
                    </Link>
                  </h2>
                  <p className="mt-1 text-[12.5px] text-[color:var(--color-text-muted)]">
                    {r.creatorNameSnapshot} · {new Date(r.createdAt).toLocaleDateString()} ·{" "}
                    <span className="tabular-nums">{r.signatureCount}</span>
                    {r.goal ? ` / ${r.goal}` : ""} signatures
                  </p>
                  <button
                    type="button"
                    onClick={() => void toggle(r.id)}
                    className="mt-2 text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline"
                  >
                    {openId === r.id ? "Hide the petition" : "Read it, with any photos and video"}
                  </button>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {r.status === "PENDING" && (
                    <>
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => void act(r.id, "approve")}
                        className="h-9 rounded-full bg-[color:var(--color-brand)] px-4 text-[13px] font-semibold text-[color:var(--color-on-brand)] disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => void act(r.id, "reject")}
                        className="h-9 rounded-full border border-[color:var(--color-border)] px-4 text-[13px] font-medium hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)] disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {r.status === "APPROVED" && (
                    <button
                      type="button"
                      disabled={busy === r.id}
                      onClick={() => void act(r.id, "close")}
                      className="h-9 rounded-full border border-[color:var(--color-border)] px-4 text-[13px] font-medium disabled:opacity-50"
                    >
                      Close
                    </button>
                  )}
                  {(r.status === "REJECTED" || r.status === "CLOSED") && (
                    <span className="rounded-full bg-[color:var(--color-surface-muted)] px-3 py-1.5 text-[12px] font-medium text-[color:var(--color-text-muted)]">
                      {r.status === "CLOSED" ? "Closed" : "Rejected"}
                    </span>
                  )}
                </div>
              </div>

              {openId === r.id && <ReviewPanel state={full[r.id]} />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * What a reviewer needs in order to decide, and nothing else: the
 * case as written, the photos, and the video. Read-only — the media
 * is fixed at submission, so there is nothing here to edit.
 */
function ReviewPanel({ state }: { state: FullPetition | "loading" | "error" | undefined }) {
  if (!state || state === "loading") {
    return (
      <p className="mt-3 border-t border-[color:var(--color-border-soft)] pt-3 text-[12.5px] text-[color:var(--color-text-subtle)]">
        Loading…
      </p>
    );
  }
  if (state === "error") {
    return (
      <p className="mt-3 border-t border-[color:var(--color-border-soft)] pt-3 text-[12.5px] text-[color:var(--color-danger)]">
        Couldn&apos;t load it. Try again.
      </p>
    );
  }

  const photos = [
    ...(state.coverUrl ? [{ url: state.coverUrl, alt: "Cover" }] : []),
    ...(state.photos ?? []).map((p) => ({ url: p.url, alt: p.alt ?? "" })),
  ];

  return (
    <div className="mt-3 space-y-3 border-t border-[color:var(--color-border-soft)] pt-3">
      {state.summary && (
        <p className="text-[13px] font-medium">{state.summary}</p>
      )}

      {/* Plain text, deliberately. The markdown is rendered on the
          public page; here the reviewer wants to see exactly what was
          typed, including anything that would render as something
          other than it reads. */}
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-[color:var(--color-surface-muted)] p-3 font-sans text-[13px] leading-relaxed text-[color:var(--color-text-muted)]">
        {state.body}
      </pre>

      {state.video && (
        <div>
          <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
            Video
          </p>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={state.video.url}
            poster={state.video.posterUrl ?? undefined}
            controls
            preload="none"
            className="max-h-64 w-full rounded-xl bg-black"
          />
        </div>
      )}

      {photos.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
            {photos.length} photo{photos.length === 1 ? "" : "s"}
          </p>
          <div className="flex flex-wrap gap-2">
            {photos.map((photo) => (
              <a
                key={photo.url}
                href={photo.url}
                target="_blank"
                rel="noreferrer"
                title={photo.alt || "Open full size"}
                className="block h-24 w-24 overflow-hidden rounded-lg border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.alt} className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
