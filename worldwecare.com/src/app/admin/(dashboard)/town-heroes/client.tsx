"use client";

/**
 * The Town Heroes review queue.
 *
 * A nomination is about a REAL NAMED PERSON who did not ask to be
 * written about, so this screen shows the moderator everything before
 * they decide — the full text, the photo, and who sent it, including
 * when the nomination is anonymous. Anonymity is a promise to other
 * readers, not to the moderation team; a malicious nomination has to
 * be traceable or the promise is unsafe to offer at all.
 *
 * Rejecting asks for a reason, because the reason is sent to the
 * member as a notification and "no" with no explanation is how people
 * stop taking part.
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Img } from "@/components/ui/img";

type Status = "PENDING" | "APPROVED" | "REJECTED";

interface Hero {
  id: string;
  slug: string;
  heroName: string;
  town: string | null;
  photoUrl: string | null;
  photoAlt: string;
  summary: string | null;
  body: string;
  nominatorName: string | null;
  nominatorRealName: string | null;
  isAnonymous: boolean;
  status: Status;
  rejectionReason: string | null;
  heartCount: number;
  isFeatured: boolean;
  approvedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

const TABS: Array<{ key: Status | "ALL"; label: string }> = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
];

export function TownHeroesAdminClient() {
  const [tab, setTab] = useState<Status | "ALL">("PENDING");
  const [heroes, setHeroes] = useState<Hero[] | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Hero | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async (status: Status | "ALL") => {
    setHeroes(null);
    const res = await fetch(`/api/admin/town-heroes?status=${status}`, {
      cache: "no-store",
    }).catch(() => null);
    const d = (await res?.json().catch(() => ({}))) as {
      heroes?: Hero[];
      pendingCount?: number;
    };
    setHeroes(d?.heroes ?? []);
    if (typeof d?.pendingCount === "number") setPendingCount(d.pendingCount);
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  const review = async (hero: Hero, action: "approve" | "reject", reason?: string) => {
    setBusyId(hero.id);
    await fetch(`/api/admin/town-heroes/${hero.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: reason ?? null }),
    }).catch(() => null);
    setBusyId(null);
    setRejectTarget(null);
    setRejectReason("");
    void load(tab);
  };

  const setFeatured = async (hero: Hero, isFeatured: boolean) => {
    setBusyId(hero.id);
    await fetch(`/api/admin/town-heroes/${hero.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFeatured }),
    }).catch(() => null);
    setBusyId(null);
    void load(tab);
  };

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Town Heroes</h1>
        <p className="mt-0.5 text-[13.5px] text-[color:var(--color-text-muted)]">
          Members nominate someone local. Nothing is public until you approve it.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
              tab === t.key
                ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
                : "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-hover)]"
            }`}
          >
            {t.label}
            {t.key === "PENDING" && pendingCount > 0 && (
              <span className="rounded-full bg-black/15 px-1.5 text-[11px] tabular-nums">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {heroes === null ? (
        <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>
      ) : heroes.length === 0 ? (
        <Card>
          <CardBody className="p-10 text-center">
            <p className="text-[15px] font-medium">Nothing here</p>
            <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">
              {tab === "PENDING" ? "The queue is empty." : "No nominations in this state."}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {heroes.map((h) => (
            <Card key={h.id}>
              <CardBody className="p-4">
                <div className="flex flex-wrap gap-4 sm:flex-nowrap">
                  <div className="h-28 w-full shrink-0 overflow-hidden rounded-xl bg-[color:var(--color-surface-muted)] sm:h-24 sm:w-32">
                    {h.photoUrl && (
                      <Img src={h.photoUrl} alt={h.photoAlt} className="h-full w-full object-cover" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[16px] font-semibold">{h.heroName}</h2>
                      {h.town && (
                        <span className="text-[12.5px] text-[color:var(--color-text-subtle)]">
                          {h.town}
                        </span>
                      )}
                      {h.isFeatured && (
                        <span className="rounded-full bg-[color:var(--color-brand)]/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-brand)]">
                          Featured
                        </span>
                      )}
                    </div>

                    {h.summary && (
                      <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">
                        {h.summary}
                      </p>
                    )}
                    <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed">
                      {h.body}
                    </p>

                    <p className="mt-2 text-[12px] text-[color:var(--color-text-subtle)]">
                      {/*
                        The real name even when anonymous — see the note
                        at the top of this file. Labelled so a moderator
                        never repeats it back to the wrong audience.
                      */}
                      Nominated by {h.nominatorRealName ?? "a deleted member"}
                      {h.isAnonymous && " · asked to stay anonymous publicly"}
                      {" · "}
                      {new Date(h.createdAt).toLocaleDateString()}
                    </p>

                    {h.status === "REJECTED" && h.rejectionReason && (
                      <p className="mt-1.5 text-[12.5px] text-[color:var(--color-danger)]">
                        Rejected: {h.rejectionReason}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {h.status !== "APPROVED" && (
                        <Button
                          size="sm"
                          loading={busyId === h.id}
                          onClick={() => void review(h, "approve")}
                        >
                          Approve
                        </Button>
                      )}
                      {h.status !== "REJECTED" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setRejectTarget(h);
                            setRejectReason("");
                          }}
                        >
                          Reject
                        </Button>
                      )}
                      {h.status === "APPROVED" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={busyId === h.id}
                            onClick={() => void setFeatured(h, !h.isFeatured)}
                          >
                            {h.isFeatured ? "Unfeature" : "Feature"}
                          </Button>
                          <a
                            href={`/town-heroes/${h.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[13px] text-[color:var(--color-brand)] underline underline-offset-2"
                          >
                            View
                          </a>
                        </>
                      )}
                      <span className="ml-auto text-[12px] text-[color:var(--color-text-subtle)]">
                        {h.heartCount} {h.heartCount === 1 ? "thank you" : "thank yous"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setRejectTarget(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Reject nomination"
            className="w-full max-w-md rounded-2xl bg-[color:var(--color-surface)] p-5 shadow-elevated"
          >
            <h2 className="text-[16px] font-semibold">
              Don&apos;t publish {rejectTarget.heroName}?
            </h2>
            <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
              This is sent to whoever nominated them, so write something they can act on.
            </p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="We couldn't confirm this one — could you add where they volunteer?"
              className="mt-3"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setRejectTarget(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={busyId === rejectTarget.id}
                onClick={() => void review(rejectTarget, "reject", rejectReason)}
              >
                Reject
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
