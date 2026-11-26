"use client";

/**
 * Event form — shared by /admin/events/new and /admin/events/[id].
 *
 * The organiser enters a wall-clock time and picks the zone it belongs
 * to; `zonedToUtc` converts to the UTC instant we store. Editing runs
 * the inverse so the field shows the time the organiser originally
 * typed, not the reader's local rendering of it.
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
import { allZones, localZone, utcToZonedInput, zonedToUtc } from "@/lib/timezone";

interface CountryOption {
  id: string;
  name: string;
  emojiFlag: string | null;
}

const LABEL = "mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]";
const SELECT =
  "h-10 w-full rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[14px]";

export function EventForm({ eventId }: { eventId?: string }) {
  const router = useRouter();
  const isEdit = !!eventId;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [countries, setCountries] = useState<CountryOption[]>([]);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [timezone, setTimezone] = useState(localZone());
  const [isOnline, setIsOnline] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");
  const [venueName, setVenueName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [countryId, setCountryId] = useState("");
  const [capacity, setCapacity] = useState("");
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/public/geo/countries");
      const d = (await res.json().catch(() => ({ items: [] }))) as { items: CountryOption[] };
      setCountries(d.items ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!eventId) return;
    void (async () => {
      const res = await fetch(`/api/admin/events/${eventId}`);
      if (!res.ok) {
        setError("Could not load this event.");
        setLoading(false);
        return;
      }
      const { event: e } = (await res.json()) as { event: Record<string, unknown> };
      const zone = (e.timezone as string) || "UTC";
      setTitle((e.title as string) ?? "");
      setSummary((e.summary as string) ?? "");
      setDescription((e.description as string) ?? "");
      setCoverUrl((e.coverUrl as string) ?? "");
      setTimezone(zone);
      setStartLocal(utcToZonedInput(e.startsAt as string, zone));
      setEndLocal(e.endsAt ? utcToZonedInput(e.endsAt as string, zone) : "");
      setIsOnline(!!e.isOnline);
      setJoinUrl((e.joinUrl as string) ?? "");
      setVenueName((e.venueName as string) ?? "");
      setAddressLine((e.addressLine as string) ?? "");
      setCity((e.city as string) ?? "");
      setCountryId((e.countryId as string) ?? "");
      setCapacity(e.capacity ? String(e.capacity) : "");
      setPhotos(Array.isArray(e.photos) ? (e.photos as GalleryPhoto[]) : []);
      setLoading(false);
    })();
  }, [eventId]);

  const save = useCallback(async () => {
    setError(null);
    setNotice(null);
    const startsAt = zonedToUtc(startLocal, timezone);
    if (!startsAt) {
      setError("Pick a start date and time");
      return;
    }
    const endsAt = endLocal ? zonedToUtc(endLocal, timezone) : null;

    setSaving(true);
    const payload = {
      title,
      summary: summary || null,
      description,
      coverUrl: coverUrl || null,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt ? endsAt.toISOString() : null,
      timezone,
      isOnline,
      joinUrl: joinUrl || null,
      venueName: venueName || null,
      addressLine: addressLine || null,
      city: city || null,
      countryId: countryId || null,
      capacity: capacity ? Number.parseInt(capacity, 10) : null,
      photos,
    };

    const res = await fetch(isEdit ? `/api/admin/events/${eventId}` : "/api/admin/events", {
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
      router.push(`/admin/events/${d.id}`);
      return;
    }
    setNotice("Saved");
  }, [
    capacity, city, addressLine, countryId, coverUrl, description, endLocal, eventId, isEdit,
    isOnline, joinUrl, photos, router, startLocal, summary, timezone, title, venueName,
  ]);

  if (loading) return <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
            {isEdit ? "Edit event" : "New event"}
          </h1>
          <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
            Events you create here are published straight away.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/events">
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
              <label className="block">
                <span className={LABEL}>Title</span>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Saturday sober coffee" />
              </label>
              <label className="block">
                <span className={LABEL}>Summary — shown on the calendar card</span>
                <Textarea value={summary} onChange={(e) => setSummary(e.target.value.slice(0, 400))} rows={2} />
              </label>
              <div>
                <span className={LABEL}>Description — Markdown supported</span>
                <div className="rounded-t-[10px] border border-b-0 border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] px-2 py-1.5">
                  <MarkdownToolbar
                    textareaRef={descriptionRef}
                    value={description}
                    onChange={setDescription}
                    uploadCategory="events"
                  />
                </div>
                <Textarea
                  ref={descriptionRef}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={10}
                  className="rounded-t-none font-mono text-[13.5px]"
                  placeholder={"What happens, who it's for, what to bring.\n\n- Meet at the bandstand\n- Free, no booking needed"}
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3 p-4">
              <p className="text-[13px] font-semibold">When</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>Starts</span>
                  <Input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
                </label>
                <label className="block">
                  <span className={LABEL}>Ends — optional</span>
                  <Input type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
                </label>
              </div>
              <label className="block">
                <span className={LABEL}>Time zone</span>
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={SELECT}>
                  {allZones().map((z) => (
                    <option key={z} value={z}>{z.replace(/_/g, " ")}</option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-[color:var(--color-text-subtle)]">
                  Times above are in this zone. Everyone sees the event at its local time, wherever
                  they are.
                </span>
              </label>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold">Where</p>
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={isOnline}
                    onChange={(e) => setIsOnline(e.target.checked)}
                    className="h-4 w-4 accent-[color:var(--color-brand)]"
                  />
                  Online event
                </label>
              </div>

              {isOnline ? (
                <label className="block">
                  <span className={LABEL}>Join link</span>
                  <Input value={joinUrl} onChange={(e) => setJoinUrl(e.target.value)} placeholder="https://…" />
                </label>
              ) : (
                <>
                  <label className="block">
                    <span className={LABEL}>Venue</span>
                    <Input value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="Riverside Community Hall" />
                  </label>
                  <label className="block">
                    <span className={LABEL}>Address</span>
                    <Input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
                  </label>
                </>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>City</span>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </label>
                <label className="block">
                  <span className={LABEL}>Country</span>
                  <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className={SELECT}>
                    <option value="">Everywhere</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emojiFlag ? `${c.emojiFlag} ` : ""}{c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardBody className="p-4">
              <ImageUpload
                value={coverUrl}
                onChange={setCoverUrl}
                category="events"
                label="Cover image"
                hint="Shown on the calendar card and the event page."
                aspect="wide"
              />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <GalleryUpload
                value={photos}
                onChange={setPhotos}
                category="events"
                label="Photos"
                hint="A flyer, the meeting point, shots from last time."
              />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-4">
              <label className="block">
                <span className={LABEL}>Capacity — optional</span>
                <Input
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder="Leave blank for unlimited"
                />
                <span className="mt-1 block text-[11px] text-[color:var(--color-text-subtle)]">
                  RSVPs stop once the cap is reached.
                </span>
              </label>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
