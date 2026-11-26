"use client";

/**
 * /search — one box, everything.
 *
 * The URL is the state. Typing debounces into `?q=`, so a result can be
 * shared or reloaded and lands on the same page — the thing a search
 * that only lives in React state can never do.
 *
 * Results come back grouped by kind and already capped; the filter
 * chips narrow what is shown rather than re-querying, because five
 * tables have already been read and asking again to hide four of them
 * would be silly.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteShell, type ShellViewer } from "./site-shell";
import { useCountry } from "./country-context";
import { Img } from "@/components/ui/img";
import { Input } from "@/components/ui/input";
import {
  SEARCH_KIND_LABELS,
  SEARCH_MIN,
  type SearchHit,
  type SearchKind,
  type SearchResults,
} from "@/lib/search";
import { useT } from "./locale-context";
import { TranslatedContent } from "./translated-content";

// Members first. When somebody types a name into a search box, the
// person is what they are looking for — everything else is a word that
// happened to match.
const KIND_ORDER: SearchKind[] = ["member", "place", "room", "event", "campaign", "article"];

export function SearchClient({
  viewer,
  initialQuery,
}: {
  viewer: ShellViewer;
  initialQuery: string;
}) {
  const t = useT();
  const router = useRouter();
  const { countryId } = useCountry();
  const [q, setQ] = useState(initialQuery);
  const [kind, setKind] = useState<SearchKind | "all">("all");
  const [data, setData] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Arriving with nothing to search for: put the cursor where the
    // person is about to type anyway.
    if (!initialQuery) boxRef.current?.focus();
  }, [initialQuery]);

  /*
   * Which search is the current one.
   *
   * The 300ms debounce stops a request per keystroke; it does not stop
   * two requests that both fired from resolving out of order. Pause
   * after "cat", carry on to "cats", and if the "cat" request is the
   * slower one its results land last and sit under a box that says
   * "cats". Sequence number, newest wins.
   */
  const seqRef = useRef(0);

  const run = useCallback(
    async (term: string) => {
      const seq = ++seqRef.current;
      if (term.trim().length < SEARCH_MIN) {
        setData(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const params = new URLSearchParams({ q: term.trim() });
      if (countryId) params.set("countryId", countryId);
      const res = await fetch(`/api/user/search?${params}`, { cache: "no-store" }).catch(
        () => null,
      );
      if (seq !== seqRef.current) return;
      setLoading(false);
      if (!res?.ok) return;
      const results = (await res.json()) as SearchResults;
      if (seq !== seqRef.current) return;
      setData(results);
    },
    [countryId],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      void run(q);
      // Keep the URL in step, without stacking a history entry per
      // keystroke — back should leave the page, not replay the typing.
      const next = q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search";
      router.replace(next, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [q, run, router]);

  const shown = useMemo(
    () => (data?.hits ?? []).filter((h) => kind === "all" || h.kind === kind),
    [data, kind],
  );

  const grouped = useMemo(() => {
    const map = new Map<SearchKind, SearchHit[]>();
    for (const k of KIND_ORDER) {
      const rows = shown.filter((h) => h.kind === k);
      if (rows.length) map.set(k, rows);
    }
    return map;
  }, [shown]);

  const total = data?.hits.length ?? 0;

  return (
    <SiteShell viewer={viewer} hideRightRail>
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("search.title", "Search")}</h1>
          <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
            {t("search.blurb", "Places, chatrooms, events, campaigns and articles.")}
          </p>
        </div>

        <Input
          ref={boxRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search.placeholder", "What are you looking for?")}
          aria-label={t("common.search", "Search")}
          className="h-12 w-full text-[15px]"
        />

        {data && total > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Chip active={kind === "all"} onClick={() => setKind("all")}>
              {t("search.everything", "Everything")} · {total}
            </Chip>
            {KIND_ORDER.filter((k) => (data.counts[k] ?? 0) > 0).map((k) => (
              <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
                {SEARCH_KIND_LABELS[k]} · {data.counts[k]}
              </Chip>
            ))}
          </div>
        )}

        {loading && !data && (
          <p className="text-[13px] text-[color:var(--color-text-subtle)]">{t("search.looking", "Looking…")}</p>
        )}

        {q.trim().length > 0 && q.trim().length < SEARCH_MIN && (
          <p className="text-[13px] text-[color:var(--color-text-subtle)]">
            {t("search.tooShort", "A couple more letters and I'll start looking.")}
          </p>
        )}

        {data && total === 0 && (
          <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center shadow-card">
            <p className="text-[15px] font-medium">{t("search.noResults", "Nothing found")}</p>
            <p className="mx-auto mt-1 max-w-[42ch] text-[13.5px] text-[color:var(--color-text-muted)]">
              {t(
                "search.noResultsBlurb",
                "Nothing matches “{q}”. Try a shorter word — someone's name, a place, a town, or what you need rather than a whole sentence.",
                { q: data.q },
              )}
            </p>
          </div>
        )}

        {[...grouped.entries()].map(([k, rows]) => (
          <section key={k} className="space-y-1.5">
            <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
              {SEARCH_KIND_LABELS[k]}
              {rows.length > 1 ? "s" : ""}
            </h2>
            <ul className="space-y-1.5">
              {rows.map((h) => (
                <li key={`${h.kind}-${h.id}`}>
                  <Link
                    href={h.href}
                    className="flex items-start gap-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-3 shadow-card transition-colors duration-200 hover:border-[color:var(--color-brand)]"
                  >
                    {h.kind === "member" ? (
                      // A face, not an emoji tile: a round avatar is how
                      // a person is shown everywhere else on the site,
                      // and a row of identical 🙂 tiles tells you
                      // nothing about which one you wanted.
                      h.avatarUrl ? (
                        <Img
                          src={h.avatarUrl}
                          alt=""
                          variant="thumb"
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-tint)] text-[14px] font-semibold text-[color:var(--color-brand)]"
                        >
                          {h.title.charAt(0).toUpperCase()}
                        </span>
                      )
                    ) : (
                      <span
                        aria-hidden
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-surface-muted)] text-[17px]"
                      >
                        {h.emoji}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold">
                        {h.kind === "member" ? (
                          // A display name is the one thing still left
                          // exactly as written — see content-kinds.
                          h.title
                        ) : (
                          <TranslatedContent
                            kind={
                              h.kind === "article"
                                ? "article"
                                : h.kind === "event"
                                  ? "event"
                                  : h.kind === "campaign"
                                    ? "campaign"
                                    : h.kind === "place"
                                      ? "place"
                                      : "room"
                            }
                            id={h.id}
                            field={h.kind === "room" || h.kind === "place" ? "name" : "title"}
                            text={h.title}
                            toggle={false}
                          />
                        )}
                      </span>
                      {/* No `block` on the clamped line below: it beats the
                          `display: -webkit-box` that line-clamp needs, and the
                          clamp goes inert. See the long note in entry-card.tsx. */}
                      {(h.subtitle || h.onlineLabel) && (
                        <span className="mt-0.5 line-clamp-2 text-[12.5px] text-[color:var(--color-text-muted)]">
                          {h.onlineLabel ? (
                            t("events.online", "Online")
                          ) : h.kind === "article" ? (
                            <TranslatedContent kind="article" id={h.id} field="excerpt" text={h.subtitle!} toggle={false} />
                          ) : h.kind === "campaign" ? (
                            <TranslatedContent kind="campaign" id={h.id} field="summary" text={h.subtitle!} toggle={false} />
                          ) : h.kind === "room" ? (
                            <TranslatedContent kind="room" id={h.id} field="description" text={h.subtitle!} toggle={false} />
                          ) : (
                            /* member location, place city — names, left alone */
                            h.subtitle
                          )}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {data?.truncated && total > 0 && (
          <p className="px-1 text-[12px] text-[color:var(--color-text-subtle)]">
            {t(
              "search.truncated",
              "Showing the closest matches. Narrow the words if what you want isn\u2019t here.",
            )}
          </p>
        )}
      </div>
    </SiteShell>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-8 items-center rounded-full border px-3 text-[12px] font-medium tabular-nums transition-colors duration-200 ${
        active
          ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
          : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-brand)]"
      }`}
    >
      {children}
    </button>
  );
}
