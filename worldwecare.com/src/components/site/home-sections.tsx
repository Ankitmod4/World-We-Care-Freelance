"use client";

/**
 * The three discovery strips on the signed-in homepage.
 *
 * THE EMPTY RULE, AND WHY IT CHANGED.
 *
 * These used to render NOTHING when they had nothing — no heading, no
 * card, no placeholder — on the reasoning that a homepage carrying
 * three empty shells tells a new member the place is dead.
 *
 * That reasoning was right about EMPTY SHELLS and wrong about what to
 * do instead. Rendering nothing made the homepage silently collapse
 * to a bare feed, and the client reviewing it asked us to "add current
 * events" to a page that has had an events section all along — he had
 * simply never seen it fire. A section that hides itself doesn't read
 * as tactful, it reads as absent.
 *
 * So the rule now: NEVER AN EMPTY SHELL, ALWAYS AN INVITATION. An
 * empty strip renders one compact row that says what the section is
 * for and offers the one action that fills it. The distinction that
 * matters is whether the empty state does any work — "no events yet"
 * is a shell; "nothing on the calendar, put something on it" with a
 * button is a prompt.
 *
 * And the invitation has to be TRUE. Members can start petitions and
 * submit events, so those invite them to. Members CANNOT open a
 * chatroom — rooms are admin-created — so that one points at the
 * directory instead. An empty state that asks for something the
 * person is not allowed to do is worse than no empty state at all.
 *
 * They also fail silently. Each fetches on its own and swallows its
 * errors: the feed is the page, and a chatroom query timing out must
 * not take the posts down with it.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCountry } from "./country-context";
import { Img } from "@/components/ui/img";
import { NavIcon } from "./nav-icons";
import { useT } from "./locale-context";
import { TranslatedContent } from "./translated-content";

/* ── shared chrome ───────────────────────────────────────────── */

function SectionHead({ title, href, cta }: { title: string; href: string; cta: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3 px-0.5">
      <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
        {title}
      </h2>
      <Link
        href={href}
        className="shrink-0 text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline"
      >
        {cta}
      </Link>
    </div>
  );
}

/**
 * What a strip shows instead of vanishing.
 *
 * Deliberately one short row rather than a full card: three of these
 * on a quiet day should read as three doors, not three apologies.
 */
function EmptyInvite({
  icon,
  line,
  href,
  cta,
}: {
  icon: React.ReactNode;
  line: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3.5 py-3 transition-colors hover:border-[color:var(--color-brand)]"
    >
      <span className="shrink-0 text-[color:var(--color-text-subtle)]" aria-hidden>
        {icon}
      </span>
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-[color:var(--color-text-muted)]">
        {line}
      </p>
      <span className="shrink-0 whitespace-nowrap text-[12.5px] font-semibold text-[color:var(--color-brand)]">
        {cta}
      </span>
    </Link>
  );
}

/* ── chatrooms ───────────────────────────────────────────────── */

interface RoomCard {
  id: string;
  slug: string;
  name: string;
  emoji: string | null;
  color: string | null;
  tier: string;
  memberCount: number;
  isMember: boolean;
  unread: number;
}

/**
 * The strip plan.docx §5 lists under the homepage and that was never
 * built.
 *
 * ROOMS YOU ARE IN COME FIRST, and the ones with unread messages
 * before those. The plan's whole ladder is lurking → asking → talking,
 * and the step people fall off is coming back to a conversation they
 * already started. Sorting by member count instead would show the same
 * four big rooms to everyone forever.
 */
export function ChatroomStrip() {
  const t = useT();
  const { countryId } = useCountry();
  const [rooms, setRooms] = useState<RoomCard[] | null>(null);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams();
    if (countryId) params.set("countryId", countryId);
    fetch(`/api/user/chatrooms?${params}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { rooms?: RoomCard[] } | null) => {
        if (alive) setRooms(d?.rooms ?? []);
      })
      .catch(() => alive && setRooms([]));
    return () => {
      alive = false;
    };
  }, [countryId]);

  // Still loading is not the same as empty — showing an invitation
  // for the half-second before the data lands makes a busy site look
  // dead every single page load.
  if (!rooms) return null;

  if (rooms.length === 0) {
    return (
      <section>
        <SectionHead
        title={t("profile.rooms", "Rooms")}
        href="/chatrooms"
        cta={t("home.browseAll", "Browse all")}
      />
        <EmptyInvite
          icon={<NavIcon name="chat" size={18} />}
          line={t("home.noRooms", "No rooms open in your area yet. There may be others elsewhere.")}
          href="/chatrooms"
          cta={t("home.seeAllRooms", "See all rooms")}
        />
      </section>
    );
  }

  const ranked = [...rooms].sort((a, b) => {
    if (a.unread !== b.unread) return b.unread - a.unread;
    if (a.isMember !== b.isMember) return a.isMember ? -1 : 1;
    return b.memberCount - a.memberCount;
  });

  return (
    <section>
      <SectionHead
        title={t("profile.rooms", "Rooms")}
        href="/chatrooms"
        cta={t("home.browseAll", "Browse all")}
      />
      {/*
        A real horizontal scroller with snap points, not a wrapped
        grid: a grid of twelve rooms is a wall that pushes the feed off
        the screen, and the feed is what people came for.

        `-mx-*` + matching padding so the strip bleeds to the edge of
        the phone — a card clipped by the viewport edge is what tells
        someone there is more to the right.
      */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex snap-x snap-mandatory gap-2">
          {ranked.slice(0, 12).map((r) => (
            <li key={r.id} className="snap-start">
              <Link
                href={`/chatrooms/${r.slug}`}
                className="flex h-[86px] w-[124px] flex-col justify-between rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-3 transition-colors hover:border-[color:var(--color-brand)]"
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-[19px] leading-none" aria-hidden>
                    {r.emoji ?? "💬"}
                  </span>
                  {r.unread > 0 && (
                    <span className="rounded-full bg-[color:var(--color-brand)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none text-[color:var(--color-on-brand)]">
                      {r.unread > 99 ? "99+" : r.unread}
                    </span>
                  )}
                </div>
                <div>
                  <p className="line-clamp-2 text-[12.5px] font-semibold leading-tight">
                    <TranslatedContent kind="room" id={r.id} field="name" text={r.name} toggle={false} />
                  </p>
                  <p className="mt-0.5 text-[10.5px] tabular-nums text-[color:var(--color-text-subtle)]">
                    {r.isMember
                      ? t("chat.joined", "Joined")
                      : r.memberCount === 1
                        ? t("home.oneMember", "1 member")
                        : t("home.nMembers", "{n} members", { n: r.memberCount })}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── events ──────────────────────────────────────────────────── */

interface EventCard {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  isOnline: boolean;
  venueName: string | null;
  city: string | null;
  coverUrl: string | null;
  rsvpCount: number;
}

/**
 * The next two things happening.
 *
 * TWO, NOT SIX. This sits inside a feed someone is scrolling; it is a
 * nudge, not the events page. Anyone who wants the calendar has a link
 * to it in the heading.
 */
export function EventsStrip() {
  const t = useT();
  const { countryId, country } = useCountry();
  const [events, setEvents] = useState<EventCard[] | null>(null);

  // True when what's showing came from the fallback rather than the
  // member's own country — the heading has to say so, or "Happening in
  // Ireland" over an event in Texas is a lie.
  const [widened, setWidened] = useState(false);

  useEffect(() => {
    let alive = true;

    const load = async (country: string | null) => {
      const params = new URLSearchParams({ perPage: "2" });
      if (country) params.set("countryId", country);
      const r = await fetch(`/api/user/events?${params}`, { cache: "no-store" }).catch(() => null);
      if (!r?.ok) return null;
      const d = (await r.json().catch(() => null)) as { events?: EventCard[] } | null;
      return d?.events ?? [];
    };

    void (async () => {
      const mine = await load(countryId ?? null);
      if (!alive) return;
      if (mine && mine.length > 0) {
        setWidened(false);
        setEvents(mine);
        return;
      }
      // Nothing locally. A young community almost never has an event in
      // YOUR country, and showing nothing on that basis is how a busy
      // calendar reads as an empty one. Widen before giving up.
      if (!countryId) {
        setEvents(mine ?? []);
        return;
      }
      const anywhere = await load(null);
      if (!alive) return;
      setWidened((anywhere?.length ?? 0) > 0);
      setEvents(anywhere ?? []);
    })();

    return () => {
      alive = false;
    };
  }, [countryId]);

  if (!events) return null;

  if (events.length === 0) {
    return (
      <section>
        <SectionHead
          title={t("home.happeningSoon", "Happening soon")}
          href="/events/category/all"
          cta={t("home.seeCalendar", "See the calendar")}
        />
        <EmptyInvite
          icon={<NavIcon name="calendar" size={18} />}
          line={t(
            "home.noEvents",
            "Nothing on the calendar yet. A walk, a coffee, a meeting — anything counts.",
          )}
          href="/events"
          cta={t("home.addEvent", "Add an event")}
        />
      </section>
    );
  }

  return (
    <section>
      <SectionHead
        title={
          widened || !country
            ? t("home.happeningSoon", "Happening soon")
            : t("home.happeningIn", "Happening in {country}", { country: country.name })
        }
        href="/events"
        cta={t("home.seeCalendar", "See the calendar")}
      />
      <ul className="space-y-2">
        {events.map((e) => (
          <li key={e.id}>
            <Link
              href={`/events/${e.slug}`}
              className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-3 transition-colors hover:border-[color:var(--color-brand)]"
            >
              <DateChip iso={e.startsAt} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-[14px] font-semibold leading-snug">
                  <TranslatedContent kind="event" id={e.id} field="title" text={e.title} toggle={false} />
                </p>
                <p className="mt-0.5 line-clamp-1 text-[12.5px] text-[color:var(--color-text-muted)]">
                  {e.isOnline
                    ? t("events.online", "Online")
                    : [e.venueName, e.city].filter(Boolean).join(" · ") ||
                      t("home.inPerson", "In person")}
                  {e.rsvpCount > 0 && " \u00b7 " + t("events.nGoing", "{n} going", { n: e.rsvpCount })}
                </p>
              </div>
              {e.coverUrl && (
                <div className="hidden h-12 w-16 shrink-0 overflow-hidden rounded-xl bg-[color:var(--color-surface-muted)] sm:block">
                  <Img src={e.coverUrl} alt="" className="h-full w-full object-cover" />
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A calendar-page date block.
 *
 * The date is the thing people scan for on an event, so it gets the
 * strongest position rather than being buried in a line of metadata.
 */
function DateChip({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-[color:var(--color-brand)]/10">
      <span className="text-[10px] font-semibold uppercase leading-none tracking-wide text-[color:var(--color-brand)]">
        {d.toLocaleDateString(undefined, { month: "short" })}
      </span>
      <span className="text-[17px] font-bold leading-tight tabular-nums text-[color:var(--color-brand)]">
        {d.getDate()}
      </span>
    </div>
  );
}

/* ── petitions ───────────────────────────────────────────────── */

interface HeroCard {
  id: string;
  slug: string;
  heroName: string;
  town: string | null;
  photoUrl: string | null;
  photoAlt: string;
  heartCount: number;
}

interface PetitionCard {
  id: string;
  slug: string;
  title: string;
  target: string;
  goal: number | null;
  signatureCount: number;
  open: boolean;
}

/**
 * Two open petitions.
 *
 * The count and the bar are the whole card — a petition asks for one
 * thing, and how close it is to getting it is the only detail that
 * decides whether someone stops scrolling.
 */
/**
 * Town Heroes — approved nominations only.
 *
 * The one strip that reads from a PUBLIC endpoint rather than
 * /api/user, because it holds nothing a reader could not already see
 * on the page it links to, and because the same component should be
 * usable on the landing page later without an account.
 *
 * The empty invitation is "nominate someone", which is an action every
 * member is actually allowed to take — unlike rooms, which are
 * admin-created and so invite you to browse instead. That rule is in
 * this file's header and it is the whole reason these are never empty
 * shells.
 */
export function TownHeroesStrip() {
  const t = useT();
  const { countryId, country } = useCountry();
  const [heroes, setHeroes] = useState<HeroCard[] | null>(null);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({ take: "6" });
    if (countryId) params.set("countryId", countryId);
    fetch(`/api/public/town-heroes?${params}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { heroes?: HeroCard[] } | null) => {
        if (alive) setHeroes(d?.heroes ?? []);
      })
      .catch(() => alive && setHeroes([]));
    return () => {
      alive = false;
    };
  }, [countryId]);

  if (!heroes) return null;

  const title = country
    ? t("home.heroesIn", "Heroes in {country}", { country: country.name })
    : t("nav.townHeroes", "Town Heroes");

  if (heroes.length === 0) {
    return (
      <section>
        <SectionHead title={title} href="/town-heroes" cta={t("common.seeAll", "See all")} />
        <EmptyInvite
          icon={<NavIcon name="star" size={18} />}
          line={t(
            "home.noHeroes",
            "Nobody nominated yet. Know someone who quietly makes things better?",
          )}
          href="/town-heroes"
          cta={t("heroes.nominate", "Nominate someone")}
        />
      </section>
    );
  }

  return (
    <section>
      <SectionHead title={title} href="/town-heroes" cta={t("common.seeAll", "See all")} />
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {heroes.slice(0, 3).map((h) => (
          <li key={h.id}>
            <Link
              href={`/town-heroes/${h.slug}`}
              className="group block overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] transition-colors hover:border-[color:var(--color-brand)]"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-[color:var(--color-surface-muted)]">
                {h.photoUrl ? (
                  <Img
                    src={h.photoUrl}
                    alt={h.photoAlt}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[color:var(--color-brand-soft)] to-[color:var(--color-surface-muted)] text-[20px] font-semibold text-[color:var(--color-text-subtle)]">
                    {h.heroName
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase() ?? "")
                      .join("")}
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="line-clamp-1 text-[13.5px] font-semibold leading-snug">
                  <TranslatedContent
                    kind="townHero"
                    id={h.id}
                    field="heroName"
                    text={h.heroName}
                    toggle={false}
                  />
                </p>
                <p className="mt-0.5 line-clamp-1 text-[11.5px] text-[color:var(--color-text-subtle)]">
                  {/*
                    The town when there is one, the thank-you count
                    when there is not. Both were English: the town
                    straight from the props, and the count assembled
                    out of a number and the bare words "thank you" /
                    "thank yous" — a shape the extractor cannot see,
                    so it could never have reached the catalogue. The
                    two keys already existed, written for the Town
                    Heroes page; this card just did not use them.
                  */}
                  {h.town ? (
                    <TranslatedContent
                      kind="townHero"
                      id={h.id}
                      field="town"
                      text={h.town}
                      toggle={false}
                    />
                  ) : h.heartCount === 1 ? (
                    t("heroes.oneThankYou", "1 thank you")
                  ) : (
                    t("heroes.nThankYous", "{n} thank yous", { n: h.heartCount })
                  )}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PetitionsStrip() {
  const t = useT();
  const { countryId } = useCountry();
  const [petitions, setPetitions] = useState<PetitionCard[] | null>(null);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({ take: "6" });
    if (countryId) params.set("country", countryId);
    fetch(`/api/user/petitions?${params}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { petitions?: PetitionCard[] } | null) => {
        if (alive) setPetitions(d?.petitions ?? []);
      })
      .catch(() => alive && setPetitions([]));
    return () => {
      alive = false;
    };
  }, [countryId]);

  // Closed ones are filtered out here rather than by the endpoint: the
  // petitions page wants them for its archive section, a homepage
  // prompt to sign does not.
  const open = petitions?.filter((p) => p.open).slice(0, 2) ?? [];
  if (!petitions) return null;

  if (open.length === 0) {
    return (
      <section>
        <SectionHead
        title={t("campaignDetail.addName", "Add your name")}
        href="/petitions"
        cta={t("petitionDetail.all", "All petitions")}
      />
        <EmptyInvite
          icon={<NavIcon name="petition" size={18} />}
          line={t(
            "home.noPetitions",
            "No petitions open right now. If something needs changing, ask for it.",
          )}
          href="/petitions/new"
          cta={t("home.startOne", "Start one")}
        />
      </section>
    );
  }

  return (
    <section>
      <SectionHead
        title={t("campaignDetail.addName", "Add your name")}
        href="/petitions"
        cta={t("petitionDetail.all", "All petitions")}
      />
      <ul className="space-y-2">
        {open.map((p) => {
          const pct = p.goal && p.goal > 0 ? Math.min(100, (p.signatureCount / p.goal) * 100) : null;
          return (
            <li key={p.id}>
              <Link
                href={`/petitions/${p.slug}`}
                className="block rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-3.5 transition-colors hover:border-[color:var(--color-brand)]"
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 text-[color:var(--color-brand)]">
                    <NavIcon name="petition" size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
                      To {p.target}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[14px] font-semibold leading-snug">
                      <TranslatedContent kind="petition" id={p.id} field="title" text={p.title} toggle={false} />
                    </p>
                    <p className="mt-1 text-[12.5px] text-[color:var(--color-text-muted)]">
                      <span className="font-semibold tabular-nums text-[color:var(--color-text)]">
                        {p.signatureCount.toLocaleString()}
                      </span>{" "}
                      {p.signatureCount === 1
                        ? t("petitions.signature", "signature")
                        : t("petitions.signatures", "signatures")}
                      {p.goal ? ` of ${p.goal.toLocaleString()}` : ""}
                    </p>
                    {/* Only with a goal — a bar with no target is a
                        decoration, same rule as the petition page. */}
                    {pct !== null && (
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color:var(--color-surface-muted)]">
                        <div
                          className="h-full rounded-full bg-[color:var(--color-brand)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
