import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { getEventBySlug, listAttendees } from "@/lib/events";
import { eventDateParts, formatEventTime } from "@/lib/timezone";
import { Markdown } from "@/lib/rich-text";
import { SiteShell } from "@/components/site/site-shell";
import { EventRsvp } from "@/components/site/event-rsvp";
import { DonateButton } from "@/components/site/donate-button";
import { LightboxImage, PhotoGallery } from "@/components/site/photo-gallery";
import { Img } from "@/components/ui/img";
import { getT } from "@/lib/i18n";
import { TranslatedContent } from "@/components/site/translated-content";
import { TranslatedMarkdown } from "@/components/site/translated-markdown";

/**
 * One event, in ONE COLUMN.
 *
 * This page used to put the facts and the RSVP in a sticky card down
 * the right-hand side, next to a narrower body. Three things were
 * wrong with that once the shell's own right rail was also on screen:
 * the reader got three columns to choose between, the prose column
 * was squeezed to about 55 characters, and the date and place were
 * printed TWICE — once as chips under the hero and again in the card,
 * a few centimetres apart.
 *
 * So: a single centred column, and the sidebar card is now a strip of
 * facts that sits in the flow between the summary and the description
 * — which is where a reader wants it anyway. When, where and how many
 * are the questions you ask before you read the description, not
 * while you are reading it. The shell's right rail is hidden here for
 * the same reason it is hidden on Settings and Search: this is a page
 * you came to read, not to browse away from.
 *
 * The chips are gone. They said the same thing as the facts strip.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  return { title: event ? event.title : "Event" };
}

/** Compact UTC stamp, the format Google Calendar's template link wants. */
function calStamp(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * One cell of the facts strip.
 *
 * The icon sits INSIDE the label rather than in its own 32px gutter,
 * which is what the old sidebar card did. Across three columns that
 * gutter was costing each fact about a fifth of its width, and the
 * addresses were wrapping to three lines because of it.
 */
function Fact({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 px-5 py-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)]">
        <span className="text-[color:var(--color-brand)]">{icon}</span>
        {title}
      </p>
      <div className="mt-1.5 text-[14px] leading-snug">{children}</div>
    </div>
  );
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getT();
  const { slug } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) redirect(`/login?next=/events/${slug}`);

  const event = await getEventBySlug(slug, viewer.id);
  if (!event) notFound();

  const attendees = await listAttendees(event.id, 24);
  const photos = Array.isArray(event.photos)
    ? (event.photos as { url: string; alt?: string }[]).filter((p) => p?.url)
    : [];
  const cancelled = event.status === "CANCELLED";
  const full = event.capacity !== null && event.rsvpCount >= event.capacity && !event.going;
  const past = new Date(event.endsAt ?? event.startsAt).getTime() < Date.now();

  const parts = eventDateParts(event.startsAt, event.timezone);
  const address = [event.venueName, event.addressLine, event.city].filter(Boolean).join(", ");
  // OpenStreetMap, to match the tiles the rest of the app uses and to
  // avoid handing a reader off to a tracker on the way to a meetup.
  const mapUrl = !event.isOnline && address
    ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`
    : null;

  // Two hours is the conventional default for an event with no stated
  // end — long enough to be useful in someone's calendar, short enough
  // not to swallow their evening.
  const calEnd = event.endsAt ?? new Date(new Date(event.startsAt).getTime() + 2 * 3600_000);
  const calendarUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(event.title)}` +
    `&dates=${calStamp(event.startsAt)}/${calStamp(calEnd)}` +
    `&details=${encodeURIComponent(event.summary ?? "")}` +
    `&location=${encodeURIComponent(event.isOnline ? (event.joinUrl ?? t("events.online", "Online")) : address)}`;

  const spotsLeft = event.capacity !== null ? Math.max(0, event.capacity - event.rsvpCount) : null;

  return (
    <SiteShell viewer={viewer}>
      {/*
        The column is capped at 44rem — a little over 70 characters at
        this body size, which is the width prose is comfortable at.
        Everything on the page shares it, including the hero, so the
        page has one left edge to read down instead of three. With the
        right rail back the content column is 800px at its widest, so
        the cap still does something: it just centres in less room.
      */}
      <article className="mx-auto w-full max-w-[44rem] pb-12">
        <nav className="mb-4">
          <Link
            href="/events"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)]"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t("eventDetail.all", "All events")}
          </Link>
        </nav>

        {cancelled && (
          <p className="mb-4 rounded-xl bg-[color:var(--color-danger)]/10 px-3.5 py-2.5 text-[13.5px] font-medium text-[color:var(--color-danger)]">
            {t("eventDetail.cancelled", "This event was cancelled.")}
          </p>
        )}
        {!cancelled && past && (
          <p className="mb-4 rounded-xl bg-[color:var(--color-surface-muted)] px-3.5 py-2.5 text-[13.5px] font-medium text-[color:var(--color-text-muted)]">
            {t("eventDetail.past", "This event has already happened.")}
          </p>
        )}

        {event.coverUrl && (
          <LightboxImage
            photo={{ url: event.coverUrl, alt: event.title }}
            className="aspect-[16/9] rounded-2xl border border-[color:var(--color-border-soft)] shadow-card"
          />
        )}

        {/* ── heading ───────────────────────────────────────────── */}
        <header className={event.coverUrl ? "mt-6" : ""}>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] sm:text-[34px]">
            <TranslatedContent kind="event" id={event.id} field="title" text={event.title} toggle={false} />
          </h1>

          {event.summary && (
            <p className="mt-3 text-[16.5px] leading-relaxed text-[color:var(--color-text-muted)]">
              <TranslatedContent kind="event" id={event.id} field="summary" text={event.summary} toggle={false} />
            </p>
          )}

          <div className="mt-4 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[color:var(--color-brand-soft)] text-[12px] font-semibold text-[color:var(--color-brand-ink)]">
              {event.hostAvatarSnapshot ? (
                <Img src={event.hostAvatarSnapshot} alt="" className="h-full w-full object-cover" />
              ) : (
                event.hostNameSnapshot.slice(0, 1).toUpperCase()
              )}
            </span>
            <p className="text-[13.5px] text-[color:var(--color-text-muted)]">
              Hosted by{" "}
              <span className="font-medium text-[color:var(--color-text)]">
                {event.hostNameSnapshot}
              </span>
            </p>
          </div>
        </header>

        {/* ── facts + the one action ────────────────────────────── */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
          <div className="grid divide-y divide-[color:var(--color-border-soft)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Fact
              title={t("eventNew.when", "When")}
              icon={
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10 6v4.25l2.75 1.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            >
              <span className="font-medium">
                {parts.weekday} {parts.day} {parts.month} · {parts.time}
              </span>
              <span className="mt-0.5 block text-[13px] text-[color:var(--color-text-muted)]">
                {event.endsAt
                  ? `until ${formatEventTime(event.endsAt, event.timezone, { withZone: true })}`
                  : formatEventTime(event.startsAt, event.timezone, { withZone: true })}
              </span>
            </Fact>

            <Fact
              title={t("placeNew.where", "Where")}
              icon={
                event.isOnline ? (
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <rect x="2.75" y="4" width="14.5" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M7 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <path d="M10 17.5s5.5-4.7 5.5-9a5.5 5.5 0 10-11 0c0 4.3 5.5 9 5.5 9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <circle cx="10" cy="8.5" r="1.9" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                )
              }
            >
              {event.isOnline ? (
                <span className="font-medium">{t("events.online", "Online")}</span>
              ) : (
                <>
                  <span className="font-medium">{event.venueName ?? t("eventDetail.location", "Location")}</span>
                  {(event.addressLine || event.city) && (
                    <span className="mt-0.5 block text-[13px] text-[color:var(--color-text-muted)]">
                      {[event.addressLine, event.city].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {mapUrl && (
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline"
                    >
                      {t("eventDetail.openMaps", "Open in Maps")}
                    </a>
                  )}
                </>
              )}
            </Fact>

            <Fact
              title={t("eventDetail.going", "Going")}
              icon={
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M2.75 16c.5-2.6 2.6-4 5.25-4s4.75 1.4 5.25 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M14 5.2A2.8 2.8 0 0116 8m1.25 8c-.24-1.9-1.1-3.1-2.5-3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              }
            >
              <span className="font-medium tabular-nums">
                {event.rsvpCount}
                {event.capacity ? ` of ${event.capacity}` : " going"}
              </span>
              {event.capacity !== null && (
                <>
                  <span
                    aria-hidden
                    className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-muted)]"
                  >
                    <span
                      className="block h-full rounded-full bg-[color:var(--color-brand)]"
                      style={{
                        width: `${Math.min(100, Math.round((event.rsvpCount / Math.max(1, event.capacity)) * 100))}%`,
                      }}
                    />
                  </span>
                  <span className="mt-1 block text-[12.5px] text-[color:var(--color-text-muted)]">
                    {spotsLeft === 0
                      ? t("eventDetail.noSpots", "No spots left")
                      : t("eventDetail.spotsLeft", "{n} spots left", { n: spotsLeft ?? 0 })}
                  </span>
                </>
              )}
            </Fact>
          </div>

          {/*
            The action sits on the foot of the same card as the facts,
            on the muted ground, so the two read as one object: here is
            what it is, here is the button. There is exactly one RSVP
            control on the page — a second copy further down would be
            a second React component with its own state, and the two
            would disagree the moment either was clicked.
          */}
          <div className="flex flex-col gap-3 border-t border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <EventRsvp
              eventId={event.id}
              initialGoing={event.going}
              initialCount={event.rsvpCount}
              disabled={cancelled}
              full={full}
              joinUrl={event.isOnline ? event.joinUrl : null}
              roomSlug={event.room?.slug ?? null}
              showCount={false}
            />
            {/* Donations sit beside the RSVP, on the same foot of the
                same card. Not offered on a cancelled or finished
                event: taking money towards something that isn't
                happening is the one outcome to avoid. The button
                hides itself entirely when Stripe isn't configured. */}
            {!cancelled && !past && (
              <DonateButton
                eventId={event.id}
                causeLabel={event.title}
                signedIn={!!viewer}
              />
            )}
            {!cancelled && !past && (
              <a
                href={calendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-center text-[12.5px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)]"
              >
                {t("eventDetail.addCalendar", "Add to calendar")}
              </a>
            )}
          </div>
        </section>

        {/* ── body ──────────────────────────────────────────────── */}
        {event.description?.trim() && (
          <section className="mt-9">
            <h2 className="mb-2.5 text-[17px] font-semibold tracking-[-0.01em]">
              {t("eventDetail.about", "About this event")}
            </h2>
            <TranslatedMarkdown kind="event" id={event.id} field="description" text={event.description} />
          </section>
        )}

        {photos.length > 0 && (
          <section className="mt-9">
            <h2 className="mb-3 text-[17px] font-semibold tracking-[-0.01em]">
              Photos{" "}
              <span className="text-[13px] font-normal text-[color:var(--color-text-subtle)]">
                ({photos.length})
              </span>
            </h2>
            <PhotoGallery photos={photos} />
          </section>
        )}

        {attendees.length > 0 && (
          <section className="mt-9 border-t border-[color:var(--color-border-soft)] pt-6">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em]">
              Who&apos;s going{" "}
              <span className="text-[13px] font-normal text-[color:var(--color-text-subtle)]">
                ({event.rsvpCount})
              </span>
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {attendees.map((a) => (
                <li
                  key={a.userId}
                  className="flex items-center gap-2 rounded-full border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] py-1 pl-1 pr-3"
                >
                  <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[color:var(--color-brand-soft)] text-[11px] font-semibold text-[color:var(--color-brand-ink)]">
                    {a.avatarSnapshot ? (
                      <Img src={a.avatarSnapshot} alt="" className="h-full w-full object-cover" />
                    ) : (
                      a.nameSnapshot.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span className="text-[13px]">{a.nameSnapshot}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </SiteShell>
  );
}
