"use client";

/**
 * Adding a place. /places/new
 *
 * A PAGE, NOT A MODAL. It used to be a dialog over the map, which put
 * a twelve-field form in a box that scrolled inside another scroll,
 * gave it no URL to link to or come back to, and lost everything typed
 * if the backdrop was clicked. Every other member submission here is a
 * page — /petitions/new, /campaigns/new, /live/new, /town-heroes/new
 * — and this is the same kind of thing, so it is the same shape.
 *
 * Short on purpose. Hours, the donor badge and the map pin are things
 * an admin adds during review; asking a member for all of it is how a
 * submission form stops getting used. What we do need is a good enough
 * address to geocode, so the address fields are the ones that get the
 * room.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { PhotoDropzone, type DropzonePhoto } from "@/components/ui/photo-dropzone";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PLACE_TYPES, type PlaceTypeValue } from "@/lib/places";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";

interface CountryOption {
  id: string;
  name: string;
  emojiFlag: string | null;
}

const LABEL = "mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]";
const FIELD =
  "h-11 w-full rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[14px] outline-none focus:border-[color:var(--color-brand)]";

export function PlaceNewClient({ viewer }: { viewer: ShellViewer }) {
  const t = useT();
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<PlaceTypeValue>("OTHER");
  const [summary, setSummary] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [countryId, setCountryId] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [needs, setNeeds] = useState("");
  const [photos, setPhotos] = useState<DropzonePhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/public/geo/countries").catch(() => null);
      const d = (await res?.json().catch(() => ({ items: [] }))) as { items?: CountryOption[] };
      setCountries(d.items ?? []);
    })();
  }, []);

  const submit = async () => {
    setError(null);
    setSaving(true);
    const res = await fetch("/api/user/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, type, summary: summary || null,
        addressLine: addressLine || null, city: city || null, postcode: postcode || null,
        countryId: countryId || null, phone: phone || null,
        website: website || null, needs: needs || null,
        // First photo becomes the cover, the rest are the gallery —
        // the same split the event and petition forms use, so anyone
        // who has met one of those already knows what happens.
        coverUrl: photos[0]?.url ?? null,
        photos: photos.slice(1),
      }),
    }).catch(() => null);
    const d = (await res?.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res?.ok) {
      setError(serverText(t, d?.error) || t("placeNew.failed", "Could not add the place"));
      return;
    }
    // STAYS ON THE PAGE rather than redirecting. A place lands PENDING
    // and is not on the map yet, so there is nowhere to send them that
    // shows what they just did — unlike a petition or a campaign,
    // which have a page of their own to wait on.
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
              "placeNew.thanksBlurb",
              "We check every place before it goes on the map, so nobody is sent to a door that isn't there. You'll get a notification either way.",
            )}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Link href="/places">
              <Button size="sm">{t("placeNew.back", "Back to places")}</Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                // A second one, without a round trip through the map.
                setDone(false);
                setName(""); setSummary(""); setAddressLine(""); setCity("");
                setPostcode(""); setPhone(""); setWebsite(""); setNeeds("");
                setPhotos([]);
              }}
            >
              {t("placeNew.addAnother", "Add another")}
            </Button>
          </div>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell viewer={viewer}>
      <Link
        href="/places"
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)]"
      >
        ← All places
      </Link>

      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
        <div className="border-b border-[color:var(--color-border-soft)] px-5 py-4">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">{t("places.add", "Add a place")}</h1>
          <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
            {t("placeNew.subtitle", "An admin checks it before it appears on the map.")}
          </p>
        </div>

        <div className="space-y-3 p-4 sm:p-5">
            <section className="space-y-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-3.5">
              <p className="text-[13px] font-semibold">{t("placeNew.whatIsIt", "What is it")}</p>
              <label className="block">
                <span className={LABEL}>{t("common.name", "Name")}</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("placeNew.namePlaceholder", "Riverside Food Bank")} />
              </label>
              <label className="block">
                <span className={LABEL}>{t("placeNew.kind", "Kind of place")}</span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as PlaceTypeValue)}
                  className={FIELD}
                >
                  {PLACE_TYPES.filter((t) => t.value !== "DONATING_BUSINESS").map((t) => (
                    <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={LABEL}>{t("placeNew.oneLine", "One line about it \u2014 optional")}</span>
                <Input
                  value={summary}
                  onChange={(e) => setSummary(e.target.value.slice(0, 400))}
                  placeholder={t("placeNew.summaryPlaceholder", "Open to anyone, no referral needed.")}
                />
              </label>
            </section>

            <section className="space-y-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-3.5">
              <p className="text-[13px] font-semibold">{t("placeNew.where", "Where")}</p>
              <p className="text-[11.5px] text-[color:var(--color-text-subtle)]">
                {t(
                  "placeNew.exactNote",
                  "As exact as you can manage \u2014 this is what puts the pin in the right street.",
                )}
              </p>
              <label className="block">
                <span className={LABEL}>{t("placeNew.street", "Street address")}</span>
                <Input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>{t("placeNew.city", "City or town")}</span>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </label>
                <label className="block">
                  <span className={LABEL}>{t("placeNew.postcode", "Postcode")}</span>
                  <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} />
                </label>
              </div>
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
            </section>

            <section className="space-y-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-3.5">
              <p className="text-[13px] font-semibold">
                {t("common.anythingElseOptional", "Anything else \u2014 optional")}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>{t("common.phone", "Phone")}</span>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </label>
                <label className="block">
                  <span className={LABEL}>{t("common.website", "Website")}</span>
                  <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
                </label>
              </div>
              <label className="block">
                <span className={LABEL}>{t("placeNew.needs", "What do they need?")}</span>
                <Input value={needs} onChange={(e) => setNeeds(e.target.value)} placeholder={t("placeNew.needsPlaceholder", "Volunteers on Saturdays, tinned food")} />
              </label>

              {/*
                Photos of a real building, submitted by somebody who
                is not the owner of it — so the wording says what
                happens next. This lands PENDING like everything else
                here, and a moderator sees the pictures before anyone
                else does.
              */}
              <div>
                <span className={LABEL}>{t("common.photos", "Photos")}</span>
                <PhotoDropzone
                  value={photos}
                  onChange={setPhotos}
                  endpoint="/api/user/upload"
                  category="places"
                  max={6}
                  coverBadge
                />
                <span className="mt-1 block text-[11.5px] text-[color:var(--color-text-subtle)]">
                  {t(
                    "placeNew.photosHint",
                    "Optional. The first one becomes the cover. A moderator looks at these before the listing goes live — don't photograph people without asking them.",
                  )}
                </span>
              </div>
            </section>
          
        </div>

        <div className="border-t border-[color:var(--color-border-soft)] px-4 py-3 sm:px-5">
          {error && (
            <p className="mb-2 text-[12.5px] text-[color:var(--color-danger)]" role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Link href="/places">
              <Button variant="secondary" size="sm">{t("common.cancel", "Cancel")}</Button>
            </Link>
            <Button size="sm" loading={saving} onClick={submit} disabled={!name.trim()}>
              {t("common.submitForReview", "Submit for review")}
            </Button>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
