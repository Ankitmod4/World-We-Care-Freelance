"use client";

/**
 * The two reader-facing surfaces for broadcasts: the list of what's
 * on, and one stream's watch page.
 *
 * Both are readable signed out. Anyone can stream and anyone can
 * watch — a live list behind a login would hide the platform from
 * exactly the person the plan describes as standing at the door.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CategoryTabs } from "./category-tabs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Img } from "@/components/ui/img";
import { HlsPlayer } from "./hls-player";
import { LiveChat } from "./live-chat";
/**
 * Type-only, so nothing from the server lib — prisma included — is
 * pulled into this client bundle. It used to be a hand-copied mirror
 * of StreamCard living in this file, which is exactly how the two
 * drifted apart when `category` was added to one and not the other.
 */
import type { StreamCard, StreamCategory } from "@/lib/live-streams";
import { PageHeading } from "./page-heading";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";
import { TranslatedContent } from "./translated-content";
import { DonateButton } from "./donate-button";

/**
 * The height the player and the chat share once they sit side by
 * side, so the two columns end together.
 *
 * The underscores are load-bearing: Tailwind turns them into spaces,
 * and `calc()` requires the spaces around its operator. Written as
 * `calc(100dvh-15rem)` it is invalid CSS, the whole declaration is
 * dropped, and the height silently never applies.
 */
const STAGE_H = "lg:h-[min(calc(100dvh_-_13rem),620px)]";

export interface LiveCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  liveCount: number;
  viewerCount: number;
}

/**
 * The category badge on a card.
 *
 * The admin's colour tints the chip rather than filling it: a
 * saturated fill at this size fights the LIVE badge for attention,
 * and an admin picking a pale colour would leave unreadable text.
 */
function CategoryBadge({ category }: { category: LiveCategory | StreamCategory }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-medium ${
        category.color
          ? ""
          : "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-muted)]"
      }`}
      style={
        category.color
          ? { backgroundColor: `${category.color}1f`, color: category.color }
          : undefined
      }
    >
      {category.emoji && <span aria-hidden>{category.emoji}</span>}
      <span className="truncate">
        <TranslatedContent kind="liveCategory" id={category.id} field="name" text={category.name} toggle={false} />
      </span>
    </span>
  );
}

/**
 * One tile in the category rail.
 *
 * Says what its numbers count. "Check-ins 3" reads as an index; "3 live
 * · 47 watching" answers the question someone actually has. A category
 * with nothing on drops to a muted "Nobody live" rather than showing a
 * 0, because a zero still looks like a statistic worth reading.
 */
/**
 * One tile in the category directory.
 *
 * A link, not a filter: clicking opens that category's own page. The
 * numbers say what they count — "Check-ins 3" reads as an index, while
 * "3 live · 47 watching" answers the question someone actually has. A
 * category with nothing on says so in words rather than showing a 0,
 * because a zero still looks like a statistic worth reading.
 */
/**
 * A live category's tile.
 *
 * The shared tile with one addition: the red dot. It is the
 * at-a-glance signal on this page — you are scanning for anything
 * that is on RIGHT NOW, and a number reads slower than a colour.
 * A quiet category still gets a tile, because "nobody live in
 * Recovery at 4am" is information.
 */

/* ── the category directory ──────────────────────────────────── */

/**
 * /live — pick a category, then pick a broadcast.
 *
 * Seeded with counts rendered on the server so the numbers are right
 * on first paint, then refreshed on a timer: someone leaves this page
 * open and a broadcast starting should change the tile under them.
 */
export function LiveCategories({
  initial,
  signedIn,
  blockedReason,
}: {
  initial: LiveCategory[];
  signedIn: boolean;
  blockedReason: string | null;
}) {
  const t = useT();
  const [categories, setCategories] = useState<LiveCategory[]>(initial);
  const [active, setActive] = useState<string | null>(null);
  const [streams, setStreams] = useState<StreamCard[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/user/live/categories", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const d = (await res.json()) as { categories?: LiveCategory[] };
    if (d.categories) setCategories(d.categories);
  }, []);

  /**
   * The broadcasts themselves, on the index.
   *
   * NO LOAD MORE HERE, and that is not an oversight. Every other
   * section pages because its list only grows; this one holds what is
   * on AIR RIGHT NOW, which is a handful at best and often none. A
   * button offering to fetch more of something there is no more of
   * would be furniture pretending to be a control.
   *
   * It refreshes on the same 30-second timer as the counts, because a
   * list of live broadcasts that is a minute stale is wrong rather
   * than merely old.
   */
  const loadStreams = useCallback(async () => {
    const qs = active ? `?category=${encodeURIComponent(active)}` : "";
    const res = await fetch(`/api/user/live${qs}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setStreams([]);
      return;
    }
    const d = (await res.json()) as { streams?: StreamCard[] };
    setStreams(d.streams ?? []);
  }, [active]);

  useEffect(() => {
    setStreams(null);
    void loadStreams();
  }, [loadStreams]);

  useEffect(() => {
    const timer = setInterval(() => {
      void load();
      void loadStreams();
    }, 30_000);
    return () => clearInterval(timer);
  }, [load, loadStreams]);

  const totalLive = categories.reduce((n, c) => n + c.liveCount, 0);

  return (
    <>
      {/*
        `note` carries the live count, which used to be half the
        sentence under the title. It changes every 30 seconds, so it
        can't live in editable copy — but it's the most useful thing on
        the page and it stays.
      */}
      <PageHeading
        title={t("page.liveTitle", "Live")}
        intro={t("page.liveIntro", "Pick a category to see what's on — or start something yourself.")}
        note={
          totalLive === 0
            ? t("live.nobodyBroadcasting", "Nobody is broadcasting at the moment.")
            : totalLive === 1
              ? t("live.oneBroadcast", "1 broadcast on right now.")
              : t("live.nBroadcasts", "{n} broadcasts on right now.", { n: totalLive })
        }
        actions={
          signedIn ? (
            blockedReason ? (
              <span className="inline-flex h-10 shrink-0 cursor-not-allowed items-center rounded-full bg-[color:var(--color-surface-muted)] px-4 text-[13.5px] font-semibold text-[color:var(--color-text-subtle)]">
                {t("live.goLive", "Go live")}
              </span>
            ) : (
              <Link
                href="/live/new"
                className="inline-flex h-10 shrink-0 items-center rounded-full bg-[color:var(--color-brand)] px-4 text-[13.5px] font-semibold text-[color:var(--color-on-brand)] transition-colors hover:bg-[color:var(--color-brand-hover)]"
              >
                {t("live.goLive", "Go live")}
              </Link>
            )
          ) : null
        }
      />

      {signedIn && blockedReason && (
        <p className="mb-5 rounded-[12px] border border-[color:var(--color-warning-soft)] bg-[color:var(--color-warning-soft)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[color:var(--color-warning-ink)]">
          {blockedReason}
        </p>
      )}

      {/* A member blocked by their own broadcast needs to reach it even
          when it is unlisted and therefore in no category listing —
          which is exactly the case when something has gone wrong and
          they are trying to get unstuck. */}
      {signedIn && blockedReason && <MyOpenStreams onChanged={() => void load()} />}

      {categories.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center shadow-card">
          <p className="text-[15px] font-medium">{t("live.noCategories", "No categories yet")}</p>
          <p className="mx-auto mt-1 max-w-[46ch] text-[13.5px] text-[color:var(--color-text-muted)]">
            {t("live.noCategoriesBlurb", "An admin needs to set these up before anyone can go live.")}
          </p>
        </div>
      ) : (
        <>
          <CategoryTabs
            kind="liveCategory"
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              emoji: c.emoji,
              count: c.liveCount,
            }))}
            value={active}
            onChange={setActive}
            allLabel={t("events.everything", "Everything")}
            label={t("live.categories", "Live categories")}
          />

          {streams === null ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="aspect-video animate-pulse rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)]"
                />
              ))}
            </div>
          ) : streams.length === 0 ? (
            <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center shadow-card">
              <p className="text-[15px] font-medium">
                {active
                  ? t("live.noneHere", "Nobody is live in here")
                  : t("live.noneNow", "Nobody is live right now")}
              </p>
              <p className="mx-auto mt-1 max-w-[46ch] text-[13.5px] text-[color:var(--color-text-muted)]">
                {signedIn && !blockedReason
                  ? t(
                      "live.beFirst",
                      "You could be the first. A quiet stream with two people watching is still two people who turned up.",
                    )
                  : t("live.tryAnother", "Try another category, or check back shortly.")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {streams.map((st) => (
                <LiveCard
                  key={st.id}
                  stream={st}
                  onChanged={() => void loadStreams()}
                  showCategory={!active}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ── one category's broadcasts ───────────────────────────────── */

/**
 * /live/category/[slug] — what's on in one category.
 *
 * Seeded from the server and polled, same as the directory. The back
 * link is always to the directory rather than history, so arriving
 * from a shared link still has somewhere to go.
 */
export function LiveInCategory({
  category,
  initial,
  signedIn,
  blockedReason,
}: {
  category: LiveCategory;
  initial: StreamCard[];
  signedIn: boolean;
  blockedReason: string | null;
}) {
  const t = useT();
  const [streams, setStreams] = useState<StreamCard[]>(initial);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/user/live?category=${encodeURIComponent(category.slug)}`,
      { cache: "no-store" },
    ).catch(() => null);
    if (!res?.ok) return;
    const d = (await res.json()) as { streams?: StreamCard[] };
    if (d.streams) setStreams(d.streams);
  }, [category.slug]);

  useEffect(() => {
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <>
      <Link
        href="/live"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-[color:var(--color-brand)]"
      >
        <span aria-hidden>&larr;</span> {t("live.allCategories", "All categories")}
      </Link>

      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[20px]"
            style={{
              backgroundColor: category.color
                ? `${category.color}1f`
                : "var(--color-surface-muted)",
            }}
            aria-hidden
          >
            {category.emoji ?? "\u2022"}
          </span>
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
              <TranslatedContent kind="liveCategory" id={category.id} field="name" text={category.name} toggle={false} />
            </h1>
            <p className="mt-0.5 max-w-[62ch] text-[13.5px] text-[color:var(--color-text-muted)]">
              {category.description ??
                (streams.length === 0
                  ? t("live.nothingHere", "Nothing on in here at the moment.")
                  : streams.length === 1
                    ? t("live.oneBroadcast", "1 broadcast on right now.")
                    : t("live.nBroadcasts", "{n} broadcasts on right now.", {
                        n: streams.length,
                      }))}
            </p>
          </div>
        </div>
        {signedIn && !blockedReason && (
          <Link
            href="/live/new"
            className="inline-flex h-10 shrink-0 items-center rounded-full bg-[color:var(--color-brand)] px-4 text-[13.5px] font-semibold text-[color:var(--color-on-brand)] transition-colors hover:bg-[color:var(--color-brand-hover)]"
          >
            {t("live.goLive", "Go live")}
          </Link>
        )}
      </header>

      {streams.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center shadow-card">
          <p className="text-[15px] font-medium">
            {t("live.noneIn", "Nobody is live in {name}", { name: category.name })}
          </p>
          <p className="mx-auto mt-1 max-w-[46ch] text-[13.5px] text-[color:var(--color-text-muted)]">
            {signedIn && !blockedReason
              ? t(
                  "live.beFirst",
                  "You could be the first. A quiet stream with two people watching is still two people who turned up.",
                )
              : t("live.tryAnother", "Try another category, or check back shortly.")}
          </p>
          <Link
            href="/live"
            className="mt-3 inline-flex h-9 items-center rounded-full border border-[color:var(--color-border)] px-4 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)]"
          >
            {t("live.seeEveryCategory", "See every category")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {streams.map((s) => (
            <LiveCard
              key={s.id}
              stream={s}
              onChanged={() => void load()}
              showCategory={false}
            />
          ))}
        </div>
      )}
    </>
  );
}

function MyOpenStreams({ onChanged }: { onChanged: () => void }) {
  const t = useT();
  const [mine, setMine] = useState<StreamCard[] | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch("/api/user/live/mine", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { streams: [] }))
      .then((d: { streams?: StreamCard[] }) => {
        if (alive) setMine((d.streams ?? []).filter((s) => s.status !== "ENDED"));
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  if (!mine || mine.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)]">
        {t("campaigns.yours", "Yours")}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mine.map((s) => (
          <LiveCard key={s.id} stream={s} onChanged={onChanged} />
        ))}
      </div>
    </section>
  );
}

function LiveCard({
  stream,
  onChanged,
  showCategory = true,
}: {
  stream: StreamCard;
  onChanged?: () => void;
  /** Off inside a category page, where every card would repeat the
   *  same badge and say nothing. */
  showCategory?: boolean;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  const end = async () => {
    if (
      !window.confirm(
        t("live.endConfirm", 'End "{title}"? Anyone watching is disconnected.', {
          title: stream.title,
        }),
      )
    )
      return;
    setBusy(true);
    await fetch(`/api/user/live/${stream.slug}/end`, { method: "POST" }).catch(() => undefined);
    setBusy(false);
    onChanged?.();
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card transition-shadow hover:shadow-elevated">
      <Link
        href={`/live/${stream.slug}`}
        className="relative block aspect-video w-full bg-gradient-to-br from-[color:var(--color-brand-soft)] to-[color:var(--color-surface-muted)]"
      >
        {/* The badge tells the truth about the row it is on. The
            browse list only holds live streams, but the owner's own
            list also shows one that was set up and never started —
            and a LIVE badge on that is the lie that sent someone
            looking for a broadcast that does not exist. */}
        {stream.status === "LIVE" ? (
          <>
            <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-danger)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--color-on-danger)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-surface)]" aria-hidden />
              {t("live.badgeLive", "LIVE")}
            </span>
            <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
              {t("live.nWatching", "{n} watching", { n: stream.viewerCount })}
            </span>
          </>
        ) : (
          <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">
            {stream.status === "IDLE"
              ? t("live.notStarted", "Not started")
              : t("live.ended", "Ended")}
          </span>
        )}
        {stream.visibility === "UNLISTED" && (
          <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
            {t("live.unlisted", "Unlisted")}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link
          href={`/live/${stream.slug}`}
          className="text-[14.5px] font-semibold leading-snug tracking-[-0.01em] line-clamp-2 hover:text-[color:var(--color-brand)]"
        >
          <TranslatedContent kind="liveStream" id={stream.id} field="title" text={stream.title} toggle={false} />
        </Link>
        {showCategory && stream.category && (
          <div className="mt-1 flex">
            <CategoryBadge category={stream.category} />
          </div>
        )}

        <p className="mt-auto flex items-center gap-2 pt-1.5 text-[12.5px] text-[color:var(--color-text-muted)]">
          <Avatar name={stream.ownerName} url={stream.ownerAvatar} />
          <span className="truncate">{stream.ownerName}</span>
        </p>

        {/* Your own stream, with the two things you'd want from a card
            you are looking at because something went wrong. */}
        {stream.isMine && (
          <div className="mt-2 flex gap-1.5 border-t border-[color:var(--color-border-soft)] pt-2">
            <Link
              href={`/live/${stream.slug}/broadcast`}
              className="inline-flex h-8 items-center rounded-full border border-[color:var(--color-border)] px-3 text-[12.5px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)]"
            >
              {t("live.controls", "Controls")}
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => void end()}
              className="inline-flex h-8 items-center rounded-full border border-[color:var(--color-border)] px-3 text-[12.5px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)] disabled:opacity-50"
            >
              {busy ? t("live.ending", "Ending…") : t("live.end", "End")}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

/* ── watching one ────────────────────────────────────────────── */

export function LiveWatch({
  slug,
  initial,
  signedIn = false,
}: {
  slug: string;
  initial: StreamCard;
  /** Chat is readable signed out; posting is not. */
  signedIn?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [stream, setStream] = useState(initial);
  const [watchUrl, setWatchUrl] = useState<string | null>(null);
  const [viewers, setViewers] = useState(initial.viewerCount);

  const load = useCallback(async () => {
    const res = await fetch(`/api/user/live/${slug}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const d = (await res.json()) as { stream: StreamCard; watchUrl: string | null };
    setStream(d.stream);
    setWatchUrl(d.watchUrl);
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  // Poll while it's live: the count, and whether it has ended.
  useEffect(() => {
    if (stream.status === "ENDED") return;
    const timer = setInterval(() => {
      void fetch(`/api/user/live/${slug}/viewers`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { viewers?: number; live?: boolean } | null) => {
          if (typeof d?.viewers === "number") setViewers(d.viewers);
          // Ended elsewhere — reload so the page stops pretending.
          if (d && d.live === false && stream.status === "LIVE") void load();
        })
        .catch(() => undefined);
    }, 10_000);
    return () => clearInterval(timer);
  }, [slug, stream.status, load]);

  return (
    <>
      {/*
       * Video and chat side by side from `lg` up, stacked below it.
       *
       * The chat is a COLUMN next to the video rather than a panel
       * under it, because on a wide screen a chat below the fold is a
       * chat nobody reads — and the video is capped in height anyway,
       * so the space beside it was already going spare.
       */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div
          className={`overflow-hidden rounded-[14px] bg-[#0b0f10] shadow-card aspect-video lg:aspect-auto ${STAGE_H}`}
        >
          <HlsPlayer
            src={stream.status === "LIVE" ? watchUrl : null}
            className="h-full w-full"
          />
        </div>

        <div className={STAGE_H}>
          <LiveChat slug={slug} status={stream.status} signedIn={signedIn} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[20px] font-semibold leading-snug tracking-[-0.02em] sm:text-[23px]">
                <TranslatedContent kind="liveStream" id={stream.id} field="title" text={stream.title} toggle={false} />
              </h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-[color:var(--color-text-muted)]">
                <Avatar name={stream.ownerName} url={stream.ownerAvatar} />
                {stream.ownerUserId ? (
                  <Link href={`/u/${stream.ownerUserId}`} className="font-medium hover:underline">
                    {stream.ownerName}
                  </Link>
                ) : (
                  <span className="font-medium">{stream.ownerName}</span>
                )}
                {stream.status === "LIVE" && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">{t("live.nWatching", "{n} watching", { n: viewers })}</span>
                  </>
                )}
                {stream.recording && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-danger)]/10 px-2 py-0.5 text-[11.5px] font-semibold text-[color:var(--color-danger)]">
                    {t("live.recording", "Recording")}
                  </span>
                )}
              </p>
            </div>

            {stream.status === "LIVE" ? (
              <div className="flex shrink-0 items-center gap-2">
                {/*
                  ONLY WHILE SOMEBODY IS ACTUALLY ON AIR.

                  `IDLE` is a broadcaster still setting up and `ENDED`
                  is over; in both cases the tip jar would be out with
                  nobody behind it. That is the same rule the event
                  page follows for a cancelled or finished event, and
                  the server applies it again on the way through — the
                  status here can be minutes old, since it is refreshed
                  by a poll, so the button being visible is never what
                  decides whether a donation is allowed.

                  The broadcast decides its own recipient server-side,
                  from `liveStreamId`. Handing the page a
                  `recipientUserId` would have been fewer moving parts
                  and worse: the donation would land with no cause on
                  it, indistinguishable in the ledger from any other
                  payment to that person.

                  Hides itself when Stripe is not connected.
                */}
                <DonateButton
                  liveStreamId={stream.id}
                  causeLabel={stream.title}
                  signedIn={signedIn}
                />
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--color-danger)] px-3 py-1.5 text-[12.5px] font-semibold text-[color:var(--color-on-danger)]">
                  <span className="h-2 w-2 rounded-full bg-[color:var(--color-surface)]" aria-hidden />
                  {t("nav.live", "Live")}
                </span>
              </div>
            ) : (
              <span className="shrink-0 rounded-full bg-[color:var(--color-surface-muted)] px-3 py-1.5 text-[12.5px] font-medium text-[color:var(--color-text-muted)]">
                {stream.status === "ENDED"
                  ? t("live.ended", "Ended")
                  : t("live.notStarted", "Not started")}
              </span>
            )}
          </div>

          {stream.summary && (
            <p className="mt-3 max-w-[70ch] whitespace-pre-wrap text-[14px] leading-relaxed">
              <TranslatedContent kind="liveStream" id={stream.id} field="summary" text={stream.summary} toggle={false} />
            </p>
          )}

          {stream.isMine && stream.status !== "ENDED" && (
            <div className="mt-4">
              <Button size="sm" onClick={() => router.push(`/live/${slug}/broadcast`)}>
                {t("live.openControls", "Open the broadcast controls")}
              </Button>
            </div>
          )}
        </div>
      </div>

      <p className="text-[12px] text-[color:var(--color-text-subtle)]">
        {t(
          "live.privacyNote",
          "Live video is carried by our streaming server, so it is encrypted while it travels but not end-to-end encrypted. Anything you broadcast {visibility}.",
          {
            visibility:
              stream.visibility === "PUBLIC"
                ? t("live.isPublic", "is public")
                : t("live.isUnlisted", "can be seen by anyone with the link"),
          },
        )}
      </p>
    </>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <Img src={url} alt="" variant="thumb" className="h-6 w-6 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-soft)] text-[10.5px] font-semibold text-[color:var(--color-brand-ink)]">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/* ── creating one ────────────────────────────────────────────── */

export function NewStream({ defaultVisibility }: { defaultVisibility: "PUBLIC" | "UNLISTED" }) {
  const t = useT();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [visibility, setVisibility] = useState(defaultVisibility);
  const [categories, setCategories] = useState<LiveCategory[] | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch("/api/user/live/categories", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d: { categories?: LiveCategory[] }) => {
        if (alive) setCategories(d.categories ?? []);
      })
      .catch(() => { if (alive) setCategories([]); });
    return () => { alive = false; };
  }, []);

  const create = async () => {
    // Belt and braces — the button is disabled without one, but a
    // stream with no category is unbrowsable and the server refuses it
    // anyway, so say so here rather than round-tripping for the error.
    if (!categoryId) {
      setError(t("live.pickCategory", "Choose a category so people can find your stream."));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/user/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, summary, visibility, categoryId }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(serverText(t, d?.error) || t("live.createFailed", "Couldn't create that stream."));
      return;
    }
    const d = (await res.json()) as { stream: StreamCard };
    // Straight to the preview — creating a stream and going live are
    // one intention, and a list page in between helps nobody.
    router.push(`/live/${d.stream.slug}/broadcast`);
  };

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("live.goLive", "Go live")}</h1>
        <p className="mt-0.5 text-[13.5px] text-[color:var(--color-text-muted)]">
          {t("live.previewFirst", "You\u2019ll see a preview before anything is broadcast.")}
        </p>
      </header>

      <div className="space-y-4 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-5 shadow-card">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
            {t("live.whatIsIt", "What is it?")}
          </span>
          <input
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("live.titlePlaceholder", "Morning walk and a chat")}
            className="h-11 w-full rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[14px] focus:border-[color:var(--color-brand)] focus:outline-none focus:ring-4 focus:ring-[color:var(--color-brand-soft)]"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
            {t("common.anythingElseOptional", "Anything else \u2014 optional")}
          </span>
          <textarea
            value={summary}
            rows={3}
            maxLength={400}
            onChange={(e) => setSummary(e.target.value)}
            className="w-full resize-none rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-[14px] leading-relaxed focus:border-[color:var(--color-brand)] focus:outline-none focus:ring-4 focus:ring-[color:var(--color-brand-soft)]"
          />
        </label>

        <fieldset>
          <legend className="mb-1.5 text-[12px] font-medium text-[color:var(--color-text-muted)]">
            {t("live.category", "Category")}
          </legend>
          {categories === null ? (
            <p className="text-[13px] text-[color:var(--color-text-subtle)]">
              {t("common.loading", "Loading\u2026")}
            </p>
          ) : categories.length === 0 ? (
            // Required, and none exist: that is an admin gap, not
            // something the member can fix. Say which, so they don't
            // sit re-clicking a dead button.
            <p className="rounded-[12px] border border-[color:var(--color-warning-soft)] bg-[color:var(--color-warning-soft)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[color:var(--color-warning-ink)]">
              {t(
                "live.noCategoriesSetUp",
                "No categories have been set up yet, so streams can\u2019t be created. Let an admin know.",
              )}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => {
                  const on = categoryId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setCategoryId(on ? "" : c.id)}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors ${
                        on
                          ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
                          : "border border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-text)]"
                      }`}
                    >
                      {c.emoji && <span aria-hidden>{c.emoji}</span>}
                      <TranslatedContent kind="liveCategory" id={c.id} field="name" text={c.name} toggle={false} />
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[12px] text-[color:var(--color-text-subtle)]">
                {categories.find((c) => c.id === categoryId)?.description ??
                  t(
                    "live.categoryHint",
                    "Pick the one closest to what you'll be doing — it's how people find you on the Live page.",
                  )}
              </p>
            </>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-[12px] font-medium text-[color:var(--color-text-muted)]">
            {t("live.whoCanWatch", "Who can watch")}
          </legend>
          <div className="space-y-2">
            <Choice
              checked={visibility === "PUBLIC"}
              onSelect={() => setVisibility("PUBLIC")}
              label={t("live.anyone", "Anyone")}
              hint={t("live.anyoneHint", "Listed on the Live page while you're broadcasting.")}
            />
            <Choice
              checked={visibility === "UNLISTED"}
              onSelect={() => setVisibility("UNLISTED")}
              label={t("live.linkOnly", "Only people I send the link to")}
              hint="Not listed anywhere. The link is unguessable, but anyone who has it can watch — treat it as shareable, not private."
            />
          </div>
        </fieldset>

        {error && <p className="text-[12.5px] text-[color:var(--color-danger)]">{error}</p>}

        <div className="flex justify-end">
          <Button
            loading={busy}
            disabled={!title.trim() || !categoryId}
            onClick={() => void create()}
          >
            {t("live.setUpCamera", "Set up the camera")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Choice({
  checked,
  onSelect,
  label,
  hint,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  hint: string;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-[12px] border p-3 transition-colors ${
        checked
          ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-soft)]/40"
          : "border-[color:var(--color-border)] hover:border-[color:var(--color-brand)]"
      }`}
    >
      <input
        type="radio"
        name="visibility"
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--color-brand)]"
      />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium">{label}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-[color:var(--color-text-subtle)]">
          {hint}
        </span>
      </span>
    </label>
  );
}
