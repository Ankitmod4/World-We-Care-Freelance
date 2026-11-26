"use client";

/**
 * /members — the directory behind the sidebar's "See more".
 *
 * ORDERED BY FOLLOWER COUNT, most-followed first, and the count is
 * shown. That was a product decision, taken knowing the alternative:
 * ranking by shared rooms and mutuals, the way the sidebar card does.
 * The two are deliberately different jobs — the card answers "who is
 * relevant to me", this page answers "who is here".
 *
 * Search is debounced and resets the cursor; the country filter
 * follows the app's current country, with an "everywhere" escape
 * hatch, because a directory that silently hides everyone outside
 * Ireland is worse than one that says it is doing so.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { useCountry } from "./country-context";
import { FollowButton, initialsOf } from "./follow-button";
import type { MemberRow } from "@/lib/follows";
import { useT } from "./locale-context";
import { TranslatedContent } from "./translated-content";

export function MembersClient({ viewer }: { viewer: ShellViewer }) {
  const t = useT();
  const { country } = useCountry();
  const [q, setQ] = useState("");
  const [hereOnly, setHereOnly] = useState(false);
  const [items, setItems] = useState<MemberRow[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  /**
   * Every response carries the query it was for. Without that, a slow
   * request for "ma" can land after a fast one for "marie" and repaint
   * the list with the wrong people — the classic search race.
   */
  const latest = useRef(0);

  const params = useCallback(
    (after?: string | null) => {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      if (hereOnly && country?.id) sp.set("country", country.id);
      if (after) sp.set("cursor", after);
      return sp.toString();
    },
    [q, hereOnly, country?.id],
  );

  useEffect(() => {
    const token = ++latest.current;
    setItems(null);
    setCursor(null);
    const t = setTimeout(() => {
      fetch(`/api/user/members?${params()}`)
        .then((r) => (r.ok ? r.json() : { items: [], nextCursor: null }))
        .then((d) => {
          if (token !== latest.current) return;
          setItems(Array.isArray(d.items) ? d.items : []);
          setCursor(d.nextCursor ?? null);
        })
        .catch(() => {
          if (token === latest.current) setItems([]);
        });
    }, 250);
    return () => clearTimeout(t);
  }, [params]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const token = latest.current;
    try {
      const res = await fetch(`/api/user/members?${params(cursor)}`);
      const d = (await res.json().catch(() => ({ items: [], nextCursor: null }))) as {
        items: MemberRow[];
        nextCursor: string | null;
      };
      if (token !== latest.current) return;
      setItems((prev) => [...(prev ?? []), ...(d.items ?? [])]);
      setCursor(d.nextCursor ?? null);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <SiteShell viewer={viewer}>
      <header className="mb-4">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("members.title", "Members")}</h1>
        <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
          {t("members.blurb", "People on WorldWeCare. Follow someone to see their posts in your feed.")}
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("members.searchPlaceholder", "Search by name")}
          aria-label={t("members.searchLabel", "Search members by name")}
          className="min-h-10 min-w-0 flex-1 rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[13px] text-[color:var(--color-text)] outline-none placeholder:text-[color:var(--color-text-subtle)] focus:border-[color:var(--color-brand)]"
        />
        {country && (
          <button
            type="button"
            onClick={() => setHereOnly((v) => !v)}
            aria-pressed={hereOnly}
            className={
              "min-h-10 shrink-0 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors " +
              (hereOnly
                ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-ink)]"
                : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-border-strong)]")
            }
          >
            In {country.name}
          </button>
        )}
      </div>

      {items === null ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <li
              key={i}
              className="h-[74px] animate-pulse rounded-[14px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)]"
            />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className="rounded-[14px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] px-4 py-8 text-center text-[13px] text-[color:var(--color-text-muted)]">
          {q.trim()
            ? t("members.noMatch", "Nobody here matches \u201c{q}\u201d.", { q: q.trim() })
            : hereOnly && country
              ? t("members.noneInCountry", "No members in {country} yet.", { country: country.name })
              : t("members.none", "No members to show yet.")}
        </p>
      ) : (
        <>
          <ul className="grid gap-2 sm:grid-cols-2">
            {items.map((m) => (
              <MemberCard key={m.id} member={m} />
            ))}
          </ul>
          {cursor && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="min-h-10 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 text-[13px] font-medium text-[color:var(--color-text)] transition-colors hover:border-[color:var(--color-border-strong)] disabled:opacity-50"
              >
                {loadingMore ? t("common.loading", "Loading…") : t("common.showMore", "Show more")}
              </button>
            </div>
          )}
        </>
      )}
    </SiteShell>
  );
}

function MemberCard({ member }: { member: MemberRow }) {
  const t = useT();
  const [followers, setFollowers] = useState(member.followerCount);

  return (
    <li className="flex items-center gap-3 rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 shadow-[var(--shadow-card)]">
      <Link href={`/u/${member.id}`} className="shrink-0">
        {member.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--color-brand)] text-[13px] font-bold text-[color:var(--color-on-brand)]">
            {initialsOf(member.displayName)}
          </span>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          href={`/u/${member.id}`}
          className="block truncate text-[13.5px] font-semibold text-[color:var(--color-text)] hover:underline"
        >
          <TranslatedContent
            kind="member"
            id={member.id}
            field="displayName"
            text={member.displayName}
            toggle={false}
          />
        </Link>
        {/* Their own words if they wrote any; the count only as a
            fallback, so a directory ordered by followers does not also
            shout the number at every row. */}
        <p className="truncate text-[11.5px] text-[color:var(--color-text-subtle)]">
          {member.bio?.trim() ? (
            <TranslatedContent
              kind="member"
              id={member.id}
              field="bio"
              text={member.bio}
              toggle={false}
            />
          ) : followers === 1 ? (
            t("members.oneFollower", "1 follower")
          ) : (
            t("members.nFollowers", "{n} followers", { n: followers.toLocaleString() })
          )}
        </p>
      </div>

      <FollowButton
        userId={member.id}
        displayName={member.displayName}
        initial={member.isFollowing}
        onChange={(f) => setFollowers((n) => Math.max(0, n + (f ? 1 : -1)))}
      />
    </li>
  );
}
