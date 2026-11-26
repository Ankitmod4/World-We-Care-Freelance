"use client";

/**
 * Place editor.
 *
 * The geocoding panel is the interesting part. Saving an address kicks
 * off exactly one Nominatim lookup, so the form has to make three
 * things visible that a normal CRUD form wouldn't:
 *
 *   • whether the place currently has coordinates at all,
 *   • why the last lookup failed, if it did,
 *   • that typing coordinates by hand overrides the lookup.
 *
 * Without those, a place quietly missing from the map looks like a bug
 * in the map.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/admin/image-upload";
import { GalleryUpload, type GalleryPhoto } from "@/components/admin/gallery-upload";
import { MarkdownToolbar } from "@/components/admin/markdown-toolbar";
import { PLACE_TYPES, dayName, parseHours, type OpeningHour } from "@/lib/places";

const LABEL = "mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]";
const SELECT =
  "h-10 w-full rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[14px]";

interface CountryOption {
  id: string;
  name: string;
  emojiFlag: string | null;
}

interface RegionOption {
  id: string;
  name: string;
}

export function PlaceForm({ placeId }: { placeId?: string }) {
  const router = useRouter();
  const isEdit = !!placeId;
  const aboutRef = useRef<HTMLTextAreaElement>(null);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [regions, setRegions] = useState<RegionOption[]>([]);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState("OTHER");
  const [summary, setSummary] = useState("");
  const [about, setAbout] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [countryId, setCountryId] = useState("");
  const [stateId, setStateId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [needs, setNeeds] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [isDonor, setIsDonor] = useState(false);
  const [status, setStatus] = useState("APPROVED");
  const [hours, setHours] = useState<OpeningHour[]>([]);

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [geocodedAt, setGeocodedAt] = useState<string | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/public/geo/countries");
      const d = (await res.json().catch(() => ({ items: [] }))) as { items: CountryOption[] };
      setCountries(d.items ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!countryId) {
      setRegions([]);
      return;
    }
    let live = true;
    void (async () => {
      const res = await fetch(`/api/public/geo/states?countryId=${encodeURIComponent(countryId)}`);
      const d = (await res.json().catch(() => ({ items: [] }))) as { items: RegionOption[] };
      if (live) setRegions(d.items ?? []);
    })();
    return () => {
      live = false;
    };
  }, [countryId]);

  const load = useCallback(async () => {
    if (!placeId) return;
    const res = await fetch(`/api/admin/places/${placeId}`, { cache: "no-store" });
    if (!res.ok) {
      setError("Could not load this place.");
      setLoading(false);
      return;
    }
    const { place: p } = (await res.json()) as { place: Record<string, unknown> };
    setName((p.name as string) ?? "");
    setSlug((p.slug as string) ?? "");
    setType((p.type as string) ?? "OTHER");
    setSummary((p.summary as string) ?? "");
    setAbout((p.about as string) ?? "");
    setAddressLine((p.addressLine as string) ?? "");
    setCity((p.city as string) ?? "");
    setPostcode((p.postcode as string) ?? "");
    setCountryId((p.countryId as string) ?? "");
    setStateId((p.stateId as string) ?? "");
    setPhone((p.phone as string) ?? "");
    setEmail((p.email as string) ?? "");
    setWebsite((p.website as string) ?? "");
    setNeeds((p.needs as string) ?? "");
    setCoverUrl((p.coverUrl as string) ?? "");
    setPhotos(Array.isArray(p.photos) ? (p.photos as GalleryPhoto[]) : []);
    setIsDonor(p.isDonor === true);
    setStatus((p.status as string) ?? "APPROVED");
    setHours(parseHours(p.hours));
    setLatitude(p.latitude != null ? String(p.latitude) : "");
    setLongitude(p.longitude != null ? String(p.longitude) : "");
    setGeocodedAt((p.geocodedAt as string) ?? null);
    setGeocodeError((p.geocodeError as string) ?? null);
    setLoading(false);
  }, [placeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setError(null);
    setNotice(null);
    if (!name.trim()) {
      setError("Give the place a name.");
      return;
    }
    setSaving(true);
    const payload = {
      name, type, summary: summary || null, about: about || null,
      addressLine: addressLine || null, city: city || null, postcode: postcode || null,
      countryId: countryId || null, stateId: stateId || null,
      phone: phone || null, email: email || null,
      website: website || null, needs: needs || null, coverUrl: coverUrl || null, photos,
      isDonor, status,
      hours: hours.length ? hours : null,
      // Sent only when both are filled — a half-typed pair should not
      // override a good geocode.
      ...(latitude.trim() && longitude.trim()
        ? { latitude: Number(latitude), longitude: Number(longitude) }
        : {}),
    };
    const res = await fetch(isEdit ? `/api/admin/places/${placeId}` : "/api/admin/places", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
    setSaving(false);
    if (!res.ok) {
      setError(d.error ?? "Save failed");
      return;
    }
    if (!isEdit && d.id) {
      router.push(`/admin/places/${d.id}`);
      return;
    }
    setNotice("Saved");
    await load();
  };

  const retryLookup = async () => {
    if (!placeId) return;
    setLocating(true);
    setError(null);
    const res = await fetch(`/api/admin/places/${placeId}/geocode`, { method: "POST" });
    const d = (await res.json().catch(() => ({}))) as {
      latitude?: number | null;
      longitude?: number | null;
      geocodeError?: string | null;
    };
    setLocating(false);
    if (d.latitude != null && d.longitude != null) {
      setLatitude(String(d.latitude));
      setLongitude(String(d.longitude));
      setGeocodeError(null);
      setNotice("Found it.");
    } else {
      setGeocodeError(d.geocodeError ?? "No match.");
    }
    await load();
  };

  const remove = async () => {
    const res = await fetch(`/api/admin/places/${placeId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Could not delete.");
      return;
    }
    router.push("/admin/places");
  };

  const setDay = (day: number, patch: Partial<OpeningHour>) => {
    setHours((prev) => {
      const existing = prev.find((h) => h.day === day);
      const next = existing
        ? prev.map((h) => (h.day === day ? { ...h, ...patch } : h))
        : [...prev, { day, ...patch }];
      return next.sort((a, b) => a.day - b.day);
    });
  };
  const clearDay = (day: number) => setHours((prev) => prev.filter((h) => h.day !== day));

  if (loading) {
    return <p className="p-6 text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>;
  }

  const mapped = latitude.trim() !== "" && longitude.trim() !== "";

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]">
            {isEdit ? name || "Edit place" : "New place"}
          </h1>
          <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
            {isEdit && slug ? (
              <>
                Live at{" "}
                <Link href={`/places/${slug}`} className="text-[color:var(--color-brand)] hover:underline">
                  /places/{slug}
                </Link>
              </>
            ) : (
              "The address is looked up once when you save — not every time someone opens the map."
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/places">
            <Button variant="secondary" size="sm">Back</Button>
          </Link>
          <Button size="sm" loading={saving} onClick={save}>Save</Button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-[color:var(--color-danger)]/10 px-3 py-2 text-[13px] text-[color:var(--color-danger)]">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl bg-[color:var(--color-brand)]/10 px-3 py-2 text-[13px] text-[color:var(--color-brand)]">
          {notice}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-3 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
                <label className="block">
                  <span className={LABEL}>Name</span>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Riverside Food Bank" />
                </label>
                <label className="block">
                  <span className={LABEL}>Type</span>
                  <select value={type} onChange={(e) => setType(e.target.value)} className={SELECT}>
                    {PLACE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className={LABEL}>Summary — one line on the card</span>
                <Input value={summary} onChange={(e) => setSummary(e.target.value.slice(0, 400))} />
              </label>
              <div>
                <span className={LABEL}>About — Markdown</span>
                <div className="rounded-t-[10px] border border-b-0 border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] px-2 py-1.5">
                  <MarkdownToolbar
                    textareaRef={aboutRef}
                    value={about}
                    onChange={setAbout}
                    uploadCategory="places"
                  />
                </div>
                <Textarea
                  ref={aboutRef}
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  rows={7}
                  className="rounded-t-none font-mono text-[13.5px]"
                />
              </div>
              <label className="block">
                <span className={LABEL}>What they need — shown prominently on the place page</span>
                <Textarea
                  value={needs}
                  onChange={(e) => setNeeds(e.target.value)}
                  rows={3}
                  placeholder="Drivers on Saturdays. Tinned fish, nappies, washing powder."
                />
              </label>
            </CardBody>
          </Card>

          {/* ── address + geocoding ───────────────────────── */}
          <Card>
            <CardBody className="space-y-3 p-4">
              <p className="text-[13px] font-semibold">Where it is</p>
              <label className="block">
                <span className={LABEL}>Street address</span>
                <Input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className={LABEL}>City</span>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </label>
                <label className="block">
                  <span className={LABEL}>Postcode</span>
                  <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} />
                </label>
                <label className="block">
                  <span className={LABEL}>Country</span>
                  <select
                    value={countryId}
                    onChange={(e) => {
                      // A region belongs to a country, so changing the country
                      // invalidates whatever region was picked under the old one.
                      setCountryId(e.target.value);
                      setStateId("");
                    }}
                    className={SELECT}
                  >
                    <option value="">Not set</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emojiFlag ? `${c.emojiFlag} ` : ""}{c.name}
                      </option>
                    ))}
                  </select>
                </label>
                {regions.length > 0 && (
                  <label className="block">
                    <span className={LABEL}>Region</span>
                    <select value={stateId} onChange={(e) => setStateId(e.target.value)} className={SELECT}>
                      <option value="">Not set</option>
                      {regions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div
                className={`rounded-xl border p-3 ${
                  mapped
                    ? "border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)]"
                    : "border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning-soft)]"
                }`}
              >
                <p className="text-[12.5px] font-medium">
                  {mapped ? "📍 On the map" : "Not on the map yet"}
                </p>
                <p className="mt-0.5 text-[11.5px] text-[color:var(--color-text-muted)]">
                  {mapped
                    ? geocodedAt
                      ? `Coordinates found ${new Date(geocodedAt).toISOString().slice(0, 10)}.`
                      : "Coordinates set."
                    : geocodeError
                      ? geocodeError
                      : "Save with an address and we'll look it up."}
                </p>

                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className={LABEL}>Latitude</span>
                    <Input
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      inputMode="decimal"
                      placeholder="53.7997"
                      className="bg-[color:var(--color-surface)] font-mono text-[13px]"
                    />
                  </label>
                  <label className="block">
                    <span className={LABEL}>Longitude</span>
                    <Input
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      inputMode="decimal"
                      placeholder="-1.5492"
                      className="bg-[color:var(--color-surface)] font-mono text-[13px]"
                    />
                  </label>
                </div>
                <p className="mt-1.5 text-[11px] text-[color:var(--color-text-subtle)]">
                  Typed coordinates win over the lookup — use them when the address is right but
                  the pin lands in the wrong place.
                </p>

                {isEdit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2"
                    loading={locating}
                    onClick={retryLookup}
                  >
                    Look the address up again
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>

          {/* ── opening hours ─────────────────────────────── */}
          <Card>
            <CardBody className="space-y-2 p-4">
              <p className="text-[13px] font-semibold">Opening hours</p>
              <p className="text-[11.5px] text-[color:var(--color-text-subtle)]">
                Leave a day blank if you don&apos;t know — an empty row is honest, a guessed one
                sends somebody to a locked door.
              </p>
              {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                const h = hours.find((x) => x.day === day);
                return (
                  <div key={day} className="flex flex-wrap items-center gap-2">
                    <span className="w-24 shrink-0 text-[12.5px] font-medium">{dayName(day)}</span>
                    <label className="flex items-center gap-1.5 text-[12px]">
                      <input
                        type="checkbox"
                        checked={h?.closed === true}
                        onChange={(e) =>
                          e.target.checked ? setDay(day, { closed: true, opens: undefined, closes: undefined }) : clearDay(day)
                        }
                        className="h-3.5 w-3.5 accent-[color:var(--color-brand)]"
                      />
                      Closed
                    </label>
                    {!h?.closed && (
                      <>
                        <Input
                          value={h?.opens ?? ""}
                          onChange={(e) => setDay(day, { opens: e.target.value, closed: false })}
                          placeholder="09:00"
                          className="h-9 w-24 font-mono text-[13px]"
                        />
                        <span className="text-[12px] text-[color:var(--color-text-subtle)]">to</span>
                        <Input
                          value={h?.closes ?? ""}
                          onChange={(e) => setDay(day, { closes: e.target.value, closed: false })}
                          placeholder="17:00"
                          className="h-9 w-24 font-mono text-[13px]"
                        />
                      </>
                    )}
                    {h && (
                      <button
                        type="button"
                        onClick={() => clearDay(day)}
                        className="text-[11.5px] text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-danger)]"
                      >
                        clear
                      </button>
                    )}
                  </div>
                );
              })}
            </CardBody>
          </Card>
        </div>

        {/* ── sidebar ──────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-3 p-4">
              <label className="block">
                <span className={LABEL}>Status</span>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={SELECT}>
                  <option value="APPROVED">Approved — on the map</option>
                  <option value="PENDING">Pending review</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CLOSED">Closed down</option>
                </select>
              </label>
              <label className="flex items-start gap-2.5 text-[13px]">
                <input
                  type="checkbox"
                  checked={isDonor}
                  onChange={(e) => setIsDonor(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[color:var(--color-brand)]"
                />
                <span>
                  Donating business
                  <span className="mt-0.5 block text-[11.5px] text-[color:var(--color-text-subtle)]">
                    Gets a green badge. Admin-only — members can&apos;t set this on a submission.
                  </span>
                </span>
              </label>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3 p-4">
              <p className="text-[13px] font-semibold">How to reach them</p>
              <label className="block">
                <span className={LABEL}>Phone</span>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className="block">
                <span className={LABEL}>Email</span>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="block">
                <span className={LABEL}>Website</span>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
              </label>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-4">
              <ImageUpload
                value={coverUrl}
                onChange={setCoverUrl}
                category="places"
                label="Photo"
                hint="A picture of the door helps someone find it."
                aspect="wide"
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-4">
              <GalleryUpload
                value={photos}
                onChange={setPhotos}
                category="places"
                label="More photos"
                hint="Inside, the entrance, opening times on the door. Shown on the listing's page under the details."
                max={10}
              />
            </CardBody>
          </Card>

          {isEdit && (
            <Card>
              <CardBody className="p-4">
                <p className="text-[13px] font-semibold">Delete this place</p>
                <p className="mt-1 text-[11.5px] text-[color:var(--color-text-subtle)]">
                  Marking it <strong>Closed down</strong> is usually better — it keeps the record
                  and the chatroom.
                </p>
                <Button variant="secondary" size="sm" className="mt-2.5" onClick={remove}>
                  Delete
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
