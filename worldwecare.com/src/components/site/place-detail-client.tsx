"use client";

/**
 * One place.
 *
 * Single column, full width, no side rail. The order is deliberate and
 * not the order the database has them in — it is the sequence someone
 * standing in the street with a phone actually wants:
 *
 *   name and what it is  →  how to act on it (call, directions, save)
 *   →  what they need  →  where it is  →  when it's open and how to
 *   reach them  →  the long read
 *
 * Nothing here formats a date or a time against the viewer's locale.
 * Opening hours are stored as plain "09:00" strings and printed as
 * given, so the server and client markup are byte-identical and this
 * page cannot hydrate-mismatch the way the campaign page once did.
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { ReportPlaceModal } from "./report-place-modal";
import { Markdown } from "@/lib/rich-text";
import { PhotoGallery, type GalleryImage } from "./photo-gallery";
import { dayName, directionsUrl, placeTypeEmoji, type OpeningHour } from "@/lib/places";
import { Img } from "@/components/ui/img";
import { useT } from "./locale-context";
import { TranslatedContent } from "./translated-content";
import { TranslatedMarkdown } from "./translated-markdown";
import { placeKindLabel } from "@/lib/place-kinds-text";
import { useTranslatedContent } from "./translated-content";

const PlaceMap = dynamic(() => import("./place-map").then((m) => m.PlaceMap), {
  ssr: false,
  loading: () => (
    <div className="min-h-[320px] rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] shadow-card sm:min-h-[420px]" />
  ),
});

export interface PlaceDetail {
  id: string;
  slug: string;
  name: string;
  type: string;
  summary: string | null;
  about: string | null;
  addressLine: string | null;
  city: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  needs: string | null;
  coverUrl: string | null;
  /** Extra photos beyond the cover. Empty when there are none. */
  photos: GalleryImage[];
  isDonor: boolean;
  saveCount: number;
  viewCount: number;
  saved: boolean;
  hours: OpeningHour[];
  room: { id: string; slug: string; name: string; memberCount: number } | null;
  country: { name: string; emojiFlag: string | null } | null;
}

export function PlaceDetailClient({
  viewer,
  place: initial,
}: {
  viewer: ShellViewer;
  place: PlaceDetail;
}) {
  const t = useT();
  const [place, setPlace] = useState(initial);
  const nameT = useTranslatedContent("place", place.id, "name", place.name);
  const [reportOpen, setReportOpen] = useState(false);

  const toggleSave = async () => {
    const before = { saved: place.saved, saveCount: place.saveCount };
    setPlace((p) => ({ ...p, saved: !p.saved, saveCount: p.saveCount + (p.saved ? -1 : 1) }));
    const res = await fetch(`/api/user/places/${place.id}/save`, { method: "POST" }).catch(() => null);
    if (!res?.ok) setPlace((p) => ({ ...p, ...before }));
  };

  // Two forms. The hero already carries a country chip, so the line under
  // the title stops at the postcode; the Contact card spells it out.
  const shortAddress = [place.addressLine, place.city, place.postcode].filter(Boolean).join(", ");
  const address = [shortAddress, place.country?.name].filter(Boolean).join(", ");
  const mapped = place.latitude !== null && place.longitude !== null;
  const directions = directionsUrl(place);

  const actionRow =
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-4 text-[13.5px] font-medium transition-colors duration-200";

  const chips = (onImage: boolean) => (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${
          onImage
            ? "frost-strong text-[color:var(--color-text)]"
            : "border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]"
        }`}
      >
        <span aria-hidden>{placeTypeEmoji(place.type)}</span>
        {placeKindLabel(t, place.type)}
      </span>
      {place.isDonor && (
        <span
          className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
            onImage
              ? "frost-strong text-[color:var(--color-success)]"
              : "bg-[color:var(--color-success)]/12 text-[color:var(--color-success)]"
          }`}
        >
          💚 Donates locally
        </span>
      )}
      {place.country?.emojiFlag && (
        <span
          className={`rounded-full px-2.5 py-1 text-[12px] ${
            onImage
              ? "frost-strong text-[color:var(--color-text-muted)]"
              : "border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)]"
          }`}
        >
          {place.country.emojiFlag} {place.country.name}
        </span>
      )}
    </div>
  );

  return (
    <SiteShell viewer={viewer}>
      <div className="space-y-5 pb-10">
        <nav>
          <Link
            href="/places"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)]"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t("places.all", "All places")}
          </Link>
        </nav>

        {/* ── 1. who they are, and what you can do about it ── */}
        <header className="overflow-hidden rounded-3xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
          {place.coverUrl ? (
            <div className="relative w-full bg-[color:var(--color-surface-muted)]">
              <Img
                src={place.coverUrl}
                alt=""
                className="h-[200px] w-full object-cover sm:h-[300px] lg:h-[340px]"
              />
              {/* Scrim, so white text survives a pale photograph. */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                {chips(true)}
                <h1 className="mt-2.5 text-[27px] font-semibold leading-tight tracking-[-0.02em] text-white drop-shadow-sm sm:text-[36px]">
                  {nameT.text}
                </h1>
              </div>
            </div>
          ) : (
            <div className="border-b border-[color:var(--color-border-soft)] bg-gradient-to-br from-[color:var(--color-brand)]/10 via-transparent to-transparent p-5 sm:p-7">
              {chips(false)}
              <h1 className="mt-2.5 text-[27px] font-semibold leading-tight tracking-[-0.02em] sm:text-[36px]">
                {nameT.text}
              </h1>
            </div>
          )}

          <div className="space-y-4 p-5 sm:p-7">
            {place.summary && (
              <p className="max-w-[70ch] text-[16px] leading-relaxed text-[color:var(--color-text-muted)]">
                <TranslatedContent kind="place" id={place.id} field="summary" text={place.summary} toggle={false} />
              </p>
            )}

            {shortAddress && (
              <p className="flex items-start gap-1.5 text-[13.5px] leading-snug text-[color:var(--color-text-muted)]">
                <span aria-hidden className="translate-y-px">📍</span>
                <span>{shortAddress}</span>
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {directions && (
                <a
                  href={directions}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${actionRow} border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]`}
                >
                  {t("placeDetail.directions", "Directions")}
                </a>
              )}
              {place.phone && (
                <a
                  href={`tel:${place.phone.replace(/\s+/g, "")}`}
                  className={`${actionRow} border-[color:var(--color-border)] text-[color:var(--color-text)]`}
                >
                  📞 {place.phone}
                </a>
              )}
              {place.website && (
                <a
                  href={place.website}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className={`${actionRow} border-[color:var(--color-border)] text-[color:var(--color-text-muted)]`}
                >
                  {t("placeDetail.visitWebsite", "Visit website")}
                </a>
              )}
              {place.email && (
                <a
                  href={`mailto:${place.email}`}
                  className={`${actionRow} border-[color:var(--color-border)] text-[color:var(--color-text-muted)]`}
                >
                  {t("placeDetail.emailThem", "Email them")}
                </a>
              )}
              <button
                type="button"
                onClick={() => void toggleSave()}
                aria-pressed={place.saved}
                className={`${actionRow} ${
                  place.saved
                    ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)]/8 text-[color:var(--color-brand)]"
                    : "border-[color:var(--color-border)] text-[color:var(--color-text-muted)]"
                }`}
              >
                {place.saved ? t("placeDetail.saved", "Saved ✓") : t("placeDetail.save", "Save this place")}
              </button>
            </div>

            <p className="text-[12px] tabular-nums text-[color:var(--color-text-subtle)]">
              {place.viewCount > 0 && (
                <>
                  {place.viewCount.toLocaleString("en-GB")}{" "}
                  {place.viewCount === 1 ? t("placeDetail.view", "view") : t("placeDetail.views", "views")} ·{" "}
                </>
              )}
              {place.saveCount} {place.saveCount === 1 ? "person has" : "people have"} saved this
            </p>
          </div>
        </header>

        {/* ── 2. what they need ─────────────────────────────── */}
        {place.needs && (
          <section className="rounded-3xl border border-[color:var(--color-brand)]/25 bg-[color:var(--color-brand)]/8 p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-brand)]">
              {t("placeDetail.whatTheyNeed", "What they need")}
            </p>
            <p className="mt-1.5 max-w-[70ch] text-[15px] leading-relaxed">{place.needs}</p>
          </section>
        )}

        {/* ── 3. the map, full width ────────────────────────── */}
        {mapped && (
          <section className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
                {t("placeDetail.whereItIs", "Where it is")}
              </h2>
              {directions && (
                <a
                  href={directions}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] font-medium text-[color:var(--color-brand)] hover:underline"
                >
                  {t("placeDetail.openDirections", "Open directions →")}
                </a>
              )}
            </div>
            <PlaceMap
              places={[
                {
                  id: place.id,
                  slug: place.slug,
                  name: place.name,
                  type: place.type,
                  latitude: place.latitude,
                  longitude: place.longitude,
                  isDonor: place.isDonor,
                  city: place.city,
                },
              ]}
              centre={{ lat: place.latitude as number, lng: place.longitude as number }}
              className="min-h-[320px] shadow-card sm:min-h-[420px]"
            />
          </section>
        )}

        {/* ── 4. the details, below the map ─────────────────── */}
        <div className="grid gap-4 lg:grid-cols-2">
          {place.hours.length > 0 && (
            <section className="rounded-3xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-5 shadow-card sm:p-6">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
                {t("placeDetail.hours", "Opening hours")}
              </h2>
              <dl className="mt-3 divide-y divide-[color:var(--color-border-soft)] text-[13.5px]">
                {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                  const h = place.hours.find((x) => x.day === day);
                  if (!h) return null;
                  return (
                    <div key={day} className="flex items-center justify-between gap-3 py-1.5">
                      <dt className="text-[color:var(--color-text-muted)]">{dayName(day)}</dt>
                      <dd
                        className={`tabular-nums ${
                          h.closed ? "text-[color:var(--color-text-subtle)]" : "font-medium"
                        }`}
                      >
                        {h.closed ? t("placeDetail.closed", "Closed") : `${h.opens} – ${h.closes}`}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              <p className="mt-2.5 text-[11.5px] text-[color:var(--color-text-subtle)]">
                {t(
                  "placeDetail.hoursNote",
                  "Days we don't know about aren't listed — ring ahead if it matters.",
                )}
              </p>
            </section>
          )}

          {(address || place.phone || place.email || place.website) && (
            <section className="rounded-3xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-5 shadow-card sm:p-6">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{t("placeDetail.contact", "Contact")}</h2>
              <dl className="mt-3 space-y-3 text-[13.5px]">
                {address && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
                      {t("placeDetail.address", "Address")}
                    </dt>
                    <dd className="mt-0.5 leading-snug">{address}</dd>
                  </div>
                )}
                {place.phone && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
                      {t("common.phone", "Phone")}
                    </dt>
                    <dd className="mt-0.5">
                      <a
                        href={`tel:${place.phone.replace(/\s+/g, "")}`}
                        className="hover:text-[color:var(--color-brand)]"
                      >
                        {place.phone}
                      </a>
                    </dd>
                  </div>
                )}
                {place.email && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
                      {t("settings.email", "Email")}
                    </dt>
                    <dd className="mt-0.5 break-all">
                      <a href={`mailto:${place.email}`} className="hover:text-[color:var(--color-brand)]">
                        {place.email}
                      </a>
                    </dd>
                  </div>
                )}
                {place.website && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
                      {t("common.website", "Website")}
                    </dt>
                    <dd className="mt-0.5 break-all">
                      <a
                        href={place.website}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="hover:text-[color:var(--color-brand)]"
                      >
                        {place.website.replace(/^https?:\/\//, "")}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>

        {/* ── 5. the long read ──────────────────────────────── */}
        {place.about?.trim() && (
          <section className="rounded-3xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-5 shadow-card sm:p-7">
            <h2 className="mb-2.5 text-[16px] font-semibold tracking-[-0.01em]">{t("placeDetail.about", "About")}</h2>
            <div className="max-w-[72ch]">
              <TranslatedMarkdown kind="place" id={place.id} field="about" text={place.about} />
            </div>
          </section>
        )}

        {/*
          ── 5b. what it looks like ─────────────────────────────
          After the details and the description, because somebody
          reading this page wants to know whether the place is open
          and how to get in before they want a tour of it.

          The cover is separate and sits at the top; these are the
          rest. Same gallery component as events and campaigns —
          click to open, arrows to move, escape to close — rather
          than links that dump the reader on a raw image URL.
        */}
        {place.photos.length > 0 && (
          <section className="rounded-3xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-5 shadow-card sm:p-7">
            <h2 className="mb-2.5 text-[16px] font-semibold tracking-[-0.01em]">{t("common.photos", "Photos")}</h2>
            <PhotoGallery photos={place.photos} />
          </section>
        )}

        {/* ── 6. ask someone who has been ───────────────────── */}
        {place.room && (
          <Link
            href={`/chatrooms/${place.room.slug}`}
            className="flex items-center gap-3 rounded-3xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-4 shadow-card transition-colors duration-200 hover:border-[color:var(--color-brand)] sm:p-5"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand)]/10 text-[color:var(--color-brand)]">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M4 5.5A1.5 1.5 0 015.5 4h9A1.5 1.5 0 0116 5.5v6A1.5 1.5 0 0114.5 13H8l-3 3v-3H5.5A1.5 1.5 0 014 11.5v-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-semibold">{t("placeDetail.askFirst", "Ask before you go")}</p>
              <p className="text-[12.5px] tabular-nums text-[color:var(--color-text-subtle)]">
                {place.room.memberCount === 1
                  ? t("placeDetail.oneInRoom", "1 person in the chatroom for {room}", {
                      room: place.room.name,
                    })
                  : t("placeDetail.nInRoom", "{n} people in the chatroom for {room}", {
                      n: place.room.memberCount,
                      room: place.room.name,
                    })}
              </p>
            </div>
            <span aria-hidden className="text-[color:var(--color-text-subtle)]">→</span>
          </Link>
        )}
        <footer className="pt-1 text-center">
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="text-[12.5px] text-[color:var(--color-text-subtle)] underline-offset-2 hover:text-[color:var(--color-danger)] hover:underline"
          >
            {t("placeDetail.reportPrompt", "Closed, moved, or something wrong here? Tell us")}
          </button>
        </footer>
      </div>

      <ReportPlaceModal
        open={reportOpen}
        placeId={place.id}
        placeName={place.name}
        onClose={() => setReportOpen(false)}
      />
    </SiteShell>
  );
}
