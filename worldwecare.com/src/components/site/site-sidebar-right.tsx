"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCountry } from "./country-context";
import type { FollowSuggestion } from "@/lib/follows";
import { followReasonText } from "@/lib/follow-reason";
import { FollowButton, initialsOf } from "./follow-button";
import { SupportCard } from "./support-card";
import { useT } from "./locale-context";
import { TRich } from "./t-rich";
import { TranslatedContent } from "./translated-content";

/**
 * Right rail for the signed-in app (xl+ only). Deliberately
 * mission-first rather than engagement filler:
 *   • Support / safety card — always reachable, the plan's core promise
 *   • Who to follow — the one thing here that grows somebody's feed
 *   • Footer — cross-link to DazzlingDish + gentle print
 *
 * WHAT REPLACED WHAT. This used to carry a "Community pulse" card —
 * members, posts today, posts this week. It was removed rather than
 * moved: three numbers that a member can do nothing with, and on a
 * quiet week "4 posts" is a worse thing to show someone than nothing
 * at all. Who to follow occupies the same slot and is actionable.
 */
export function SiteSidebarRight() {
  const t = useT();
  const { country } = useCountry();

  return (
    <div className="flex flex-col gap-4 text-[13px]">
      <SupportCard />
      <WhoToFollowCard />
      <FooterCard countryName={country?.name ?? null} />
    </div>
  );
}

/* ── Who to follow ──────────────────────────────────────────── */

/**
 * Three people, each with a line saying why, and a Follow button that
 * works without leaving the page.
 *
 * THE CARD DOES NOT RENDER AT ALL WHEN THERE IS NOBODY TO SUGGEST —
 * signed out, offline, or a community small enough that the viewer
 * already follows everyone. An empty "Who to follow" heading is worse
 * than a shorter sidebar, and on a small community it is also a
 * statement about how small it is.
 *
 * Rows STAY after you follow, showing "Following", rather than
 * vanishing. A row that disappears under the cursor takes the next
 * one's Follow button to where you were already clicking, and the
 * second follow is then an accident.
 */
function WhoToFollowCard() {
  const t = useT();
  const [people, setPeople] = useState<FollowSuggestion[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/user/follow/suggestions")
      .then((r) => (r.ok ? r.json() : { people: [] }))
      .then((d) => {
        if (alive) setPeople(Array.isArray(d.people) ? d.people : []);
      })
      .catch(() => {
        if (alive) setPeople([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (people?.length === 0) return null;

  return (
    <section className="rounded-[16px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
      <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-text-subtle)]">
        {t("rail.whoToFollow", "Who to follow")}
      </p>
      <div className="mt-2 space-y-0.5">
        {people === null
          ? [0, 1, 2].map((i) => <SuggestionSkeleton key={i} />)
          : people.map((p) => <SuggestionRow key={p.id} person={p} />)}
      </div>
      {people !== null && (
        <Link
          href="/members"
          className="mt-2 block border-t border-[color:var(--color-border-soft)] pt-2 text-center text-[11.5px] font-medium text-[color:var(--color-brand)] hover:underline"
        >
          {t("rail.seeMore", "See more")}
        </Link>
      )}
    </section>
  );
}

function SuggestionSkeleton() {
  return (
    <div className="flex items-center gap-2.5 p-2">
      <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-[color:var(--color-surface-muted)]" />
      <span className="flex-1 space-y-1.5">
        <span className="block h-3 w-24 animate-pulse rounded bg-[color:var(--color-surface-muted)]" />
        <span className="block h-2.5 w-16 animate-pulse rounded bg-[color:var(--color-surface-muted)]" />
      </span>
    </div>
  );
}

function SuggestionRow({ person }: { person: FollowSuggestion }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] p-2 transition-colors hover:bg-[color:var(--color-surface-hover)]">
      <Link href={`/u/${person.id}`} className="shrink-0">
        {person.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-brand)] text-[11px] font-bold text-[color:var(--color-on-brand)]">
            {initialsOf(person.displayName)}
          </span>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          href={`/u/${person.id}`}
          className="block truncate text-[12.5px] font-semibold text-[color:var(--color-text)] hover:underline"
        >
          {/*
            THE NAME IS LEFT EXACTLY AS THE MEMBER WROTE IT.

            This is the one place on the site where a name is deliberately
            NOT translated, by the owner's decision. It is a list of
            strangers being suggested to follow: the only thing a reader
            has to go on is the name itself, and it is also what they will
            see on the profile they click through to and in the follow
            button beside it. A machine-rewritten name here would be a
            different person from the one they meant to follow.

            Everywhere else — the profile, the members directory, a post
            byline — names still go through the translator, which is the
            call recorded in `content-kinds.ts`. Nothing about that has
            changed; this row is a carve-out, not a reversal, so do not
            "fix" it back by matching the other call sites.
          */}
          {person.displayName}
        </Link>
        <p className="truncate text-[11px] text-[color:var(--color-text-subtle)]">
          {person.reason.kind === "sharedRoom" ? (
            /*
               The room's name is content, so it goes through the
               translator; the sentence around it is interface text
               and goes through `t()`. Splitting them here keeps the
               shape of the sentence in the translator's hands — a
               language that puts the room first still can.
            */
            <TRich
              text={t("follow.reason.sharedRoom", "Also in {room}", { room: "{room}" })}
              vars={{
                room: (
                  <TranslatedContent
                    kind="room"
                    id={person.reason.roomId}
                    field="name"
                    text={person.reason.room}
                    toggle={false}
                  />
                ),
              }}
            />
          ) : (
            followReasonText(t, person.reason)
          )}
        </p>
      </div>

      <FollowButton userId={person.id} displayName={person.displayName} />
    </div>
  );
}

/* ── Footer ─────────────────────────────────────────────────── */

function FooterCard({ countryName }: { countryName: string | null }) {
  const t = useT();
  return (
    <div className="px-1 space-y-3">
      {/* Cross-link to the sibling platform (see plan.docx). Update the
          href if DazzlingDish moves. */}
      <a
        href="https://dazzlingdish.com"
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3.5 hover:border-[color:var(--color-border-strong)] transition-colors"
      >
        <p className="text-[12px] font-semibold text-[color:var(--color-text)]">
          {t("rail.alsoFromTeam", "Also from our team")}
        </p>
        <p className="text-[12.5px] text-[color:var(--color-brand)] font-medium mt-0.5">
          DazzlingDish →
        </p>
        <p className="text-[11.5px] text-[color:var(--color-text-subtle)] mt-0.5 leading-snug">
          {t("rail.dazzlingDishBlurb", "A community for food, recipes & culture.")}
        </p>
      </a>

      <p className="text-[11px] leading-relaxed text-[color:var(--color-text-subtle)] px-1">
        {countryName
          ? t("rail.viewingCountry", "Viewing {country} \u00b7 ", { country: countryName })
          : ""}
        {t("rail.tagline", "WorldWeCare \u2014 people helping people.")}
      </p>
    </div>
  );
}
