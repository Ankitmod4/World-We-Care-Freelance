"use client";

/**
 * Member-facing event submission. /events/new
 *
 * A PAGE, NOT A MODAL. It used to be a dialog over the calendar, which
 * put a long form in a box that scrolled inside another scroll, gave
 * it no URL to link to or come back to, and lost everything typed if
 * the backdrop was clicked. Every other member submission here is a
 * page — /petitions/new, /campaigns/new, /live/new, /town-heroes/new
 * — and this is the same kind of thing, so it is the same shape.
 *
 * Deliberately shorter than the admin form — capacity and
 * fine-grained scheduling are things an admin can add during review.
 * Asking a member for all of it up front is how a submission form
 * stops getting used. The fields are grouped into three plain
 * questions (what / when / where) rather than one long stack.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PhotoDropzone, type DropzonePhoto } from "@/components/ui/photo-dropzone";
import { FormatToolbar } from "@/components/ui/format-toolbar";
import { Markdown } from "@/lib/rich-text";
import { allZones, localZone, zonedToUtc } from "@/lib/timezone";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  emoji: string | null;
  color: string | null;
}

interface CountryOption {
  id: string;
  name: string;
  emojiFlag: string | null;
}

const LABEL = "mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]";
const FIELD =
  "h-11 w-full rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[14px] outline-none focus:border-[color:var(--color-brand)]";
const SECTION =
  "rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-3.5 space-y-3";
const SECTION_TITLE = "text-[13px] font-semibold tracking-[-0.01em]";


export function EventNewClient({ viewer }: { viewer: ShellViewer }) {
  const t = useT();
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [timezone, setTimezone] = useState(localZone());
  const [isOnline, setIsOnline] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");
  const [venueName, setVenueName] = useState("");
  const [city, setCity] = useState("");
  const [countryId, setCountryId] = useState("");
  const [photos, setPhotos] = useState<DropzonePhoto[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/public/geo/countries").catch(() => null);
      const d = (await res?.json().catch(() => ({ items: [] }))) as { items?: CountryOption[] };
      setCountries(d.items ?? []);
    })();
    void (async () => {
      const res = await fetch("/api/public/event-categories").catch(() => null);
      const d = (await res?.json().catch(() => ({ categories: [] }))) as {
        categories?: CategoryOption[];
      };
      setCategories(d.categories ?? []);
    })();
  }, []);

  const submit = async () => {
    setError(null);
    const startsAt = zonedToUtc(startLocal, timezone);
    if (!startsAt) {
      setError(t("eventNew.needDate", "Pick a date and time"));
      return;
    }
    setSaving(true);
    const res = await fetch("/api/user/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        startsAt: startsAt.toISOString(),
        timezone,
        isOnline,
        joinUrl: joinUrl || null,
        venueName: venueName || null,
        city: city || null,
        countryId: countryId || null,
        categoryId: categoryId || null,
        // First photo doubles as the calendar card's cover; the rest
        // become the event's gallery.
        coverUrl: photos[0]?.url ?? null,
        photos: photos.slice(1),
      }),
    }).catch(() => null);
    const d = (await res?.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res?.ok) {
      setError(serverText(t, d?.error) || t("eventNew.failed", "Could not submit the event"));
      return;
    }
    // STAYS ON THE PAGE rather than redirecting. The event lands
    // PENDING and is not on the calendar yet, so there is nowhere to
    // send them that shows what they just did.
    setDone(true);
  };

  if (done) {
    return (
      <SiteShell viewer={viewer}>
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] px-5 py-10 text-center shadow-card">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-brand)]/10 text-[color:var(--color-brand)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="text-[16px] font-semibold">{t("common.thanksWithTeam", "Thanks — it's with our team")}</p>
          <p className="mx-auto mt-1.5 max-w-[38ch] text-[13.5px] text-[color:var(--color-text-muted)]">
            {t(
              "eventNew.thanksBlurb",
              "We check submissions before they go live so the calendar stays safe. You'll get a notification either way.",
            )}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Link href="/events">
              <Button size="sm">{t("eventNew.back", "Back to events")}</Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setDone(false);
                setTitle(""); setDescription(""); setStartLocal("");
                setJoinUrl(""); setVenueName(""); setCity(""); setPhotos([]);
              }}
            >
              {t("eventNew.submitAnother", "Submit another")}
            </Button>
          </div>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell viewer={viewer}>
      <Link
        href="/events"
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)]"
      >
        ← All events
      </Link>

      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
        <div className="border-b border-[color:var(--color-border-soft)] px-5 py-4">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">{t("events.submit", "Submit an event")}</h1>
          <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
            {t("eventNew.subtitle", "An admin reviews it before it appears on the calendar.")}
          </p>
        </div>

        <div className="space-y-3 p-4 sm:p-5">
            <section className={SECTION}>
              <p className={SECTION_TITLE}>{t("eventNew.whatsHappening", "What\u2019s happening")}</p>
              <label className="block">
                <span className={LABEL}>{t("eventNew.title", "Name of the event")}</span>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("eventNew.titlePlaceholder", "Saturday morning park walk")}
                />
              </label>
              {/* Chips rather than a <select>: the list is short, and
                  seeing the whole taxonomy at once is what tells a
                  first-time organiser what sort of thing belongs here. */}
              {categories.length > 0 && (
                <div>
                  <span className={LABEL}>{t("eventNew.kind", "What kind of event is it?")}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((c) => {
                      const on = categoryId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setCategoryId(on ? "" : c.id)}
                          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors ${
                            on
                              ? "border-transparent bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
                              : "border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-brand)]"
                          }`}
                        >
                          {c.emoji && <span aria-hidden>{c.emoji}</span>}
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className={`${LABEL} mb-0`}>{t("eventNew.describe", "Tell people what to expect")}</span>
                  <div className="flex rounded-full bg-[color:var(--color-surface-muted)] p-0.5">
                    {([false, true] as const).map((preview) => (
                      <button
                        key={String(preview)}
                        type="button"
                        onClick={() => setPreviewing(preview)}
                        className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-200 ${
                          previewing === preview
                            ? "bg-[color:var(--color-surface)] text-[color:var(--color-text)] shadow-card"
                            : "text-[color:var(--color-text-muted)]"
                        }`}
                      >
                        {preview ? t("common.preview", "Preview") : t("common.write", "Write")}
                      </button>
                    ))}
                  </div>
                </div>

                {previewing ? (
                  <div className="min-h-[124px] rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
                    {description.trim() ? (
                      <Markdown text={description} />
                    ) : (
                      <p className="text-[13px] text-[color:var(--color-text-subtle)]">
                        {t("common.nothingToPreview", "Nothing to preview yet.")}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="rounded-t-[10px] border border-b-0 border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] px-1.5 py-1">
                      <FormatToolbar
                        textareaRef={bodyRef}
                        value={description}
                        onChange={setDescription}
                      />
                    </div>
                    <textarea
                      ref={bodyRef}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={5}
                      placeholder={t(
                        "eventNew.bodyPlaceholder",
                        "Who it's for, what happens, anything to bring.\n\n- Meet at the bandstand\n- Free, no booking needed",
                      )}
                      className="w-full resize-y rounded-b-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 text-[14px] outline-none focus:border-[color:var(--color-brand)]"
                    />
                    <p className="mt-1 text-[11.5px] text-[color:var(--color-text-subtle)]">
                      {t(
                        "common.markdownHint",
                        "Use the buttons above to add headings, bold text and lists — or type Markdown directly.",
                      )}
                    </p>
                  </>
                )}
              </div>
            </section>

            <section className={SECTION}>
              <p className={SECTION_TITLE}>{t("eventNew.when", "When")}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>{t("eventNew.dateTime", "Date and time")}</span>
                  <input
                    type="datetime-local"
                    value={startLocal}
                    onChange={(e) => setStartLocal(e.target.value)}
                    className={FIELD}
                  />
                </label>
                <label className="block">
                  <span className={LABEL}>{t("eventNew.timezone", "Time zone")}</span>
                  <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={FIELD}>
                    {allZones().map((z) => (
                      <option key={z} value={z}>{z.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="text-[11.5px] text-[color:var(--color-text-subtle)]">
                {t(
                  "eventNew.localTimeNote",
                  "Enter the local time where the event happens \u2014 everyone else sees it converted.",
                )}
              </p>
            </section>

            <section className={SECTION}>
              <div className="flex items-center justify-between gap-3">
                <p className={SECTION_TITLE}>{t("placeNew.where", "Where")}</p>
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={isOnline}
                    onChange={(e) => setIsOnline(e.target.checked)}
                    className="h-4 w-4 accent-[color:var(--color-brand)]"
                  />
                  {t("eventNew.isOnline", "It's online")}
                </label>
              </div>

              {isOnline ? (
                <label className="block">
                  <span className={LABEL}>{t("eventNew.joinLink", "Join link")}</span>
                  <Input value={joinUrl} onChange={(e) => setJoinUrl(e.target.value)} placeholder="https://…" />
                </label>
              ) : (
                <label className="block">
                  <span className={LABEL}>{t("eventNew.venue", "Venue or meeting point")}</span>
                  <Input
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    placeholder={t("eventNew.venuePlaceholder", "Riverside bandstand")}
                  />
                </label>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>{t("eventNew.city", "City")}</span>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </label>
                <label className="block">
                  <span className={LABEL}>{t("common.country", "Country")}</span>
                  <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className={FIELD}>
                    <option value="">{t("common.notSure", "Not sure")}</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emojiFlag ? `${c.emojiFlag} ` : ""}{c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className={SECTION}>
              <p className={SECTION_TITLE}>{t("common.photosOptional", "Photos \u2014 optional")}</p>
              <PhotoDropzone
                value={photos}
                onChange={setPhotos}
                endpoint="/api/user/upload"
                max={4}
                coverBadge
                hint={t(
                  "eventNew.photosHint",
                  "The first photo becomes the calendar card. A flyer or a shot from last time works well.",
                )}
              />
            </section>
          
        </div>

        <div className="border-t border-[color:var(--color-border-soft)] px-4 py-3 sm:px-5">
          {error && (
            <p className="mb-2 text-[12.5px] text-[color:var(--color-danger)]" role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Link href="/events">
              <Button variant="secondary" size="sm">{t("common.cancel", "Cancel")}</Button>
            </Link>
            <Button
              size="sm"
              loading={saving}
              onClick={submit}
              disabled={
                !title.trim() ||
                !description.trim() ||
                !startLocal ||
                // Only enforced once the list has loaded — a slow
                // fetch must not lock someone out of the form.
                (categories.length > 0 && !categoryId)
              }
            >
              {t("common.submitForReview", "Submit for review")}
            </Button>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
