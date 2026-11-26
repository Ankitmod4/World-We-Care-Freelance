"use client";

/**
 * One place, as a row.
 *
 * Shared by /places and /places/category/[slug]. It lived inside
 * places-client until the category page needed the same row; a second
 * copy would have been a second place to fix every bug in it.
 *
 * The bookmark is a prop rather than a hook, because the two pages
 * hold the list differently — the directory keeps it in state it
 * re-fetches, the category page is handed it by the server.
 */

import Link from "next/link";
import { Img } from "@/components/ui/img";
import { placeTypeEmoji } from "@/lib/places";
import { useT } from "./locale-context";
import { TranslatedContent } from "./translated-content";
import { placeKindLabel } from "@/lib/place-kinds-text";

export interface PlaceCard {
  id: string;
  slug: string;
  name: string;
  type: string;
  summary: string | null;
  addressLine: string | null;
  city: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  isDonor: boolean;
  coverUrl: string | null;
  saveCount: number;
  needs: string | null;
  saved: boolean;
  distanceKm: number | null;
}


export function PlaceRow({
  place,
  onToggleSave,
}: {
  place: PlaceCard;
  onToggleSave: () => void;
}) {
  const t = useT();
  const where = [place.addressLine, place.city].filter(Boolean).join(", ");
  return (
    <div className="group flex h-full gap-3 rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-3 shadow-card transition-shadow duration-200 hover:shadow-elevated">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[color:var(--color-surface-muted)] text-[20px]">
        {place.coverUrl ? (
          <Img src={place.coverUrl} alt="" variant="thumb" className="h-full w-full object-cover" />
        ) : (
          placeTypeEmoji(place.type)
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/places/${place.slug}`}
            className="text-[14.5px] font-semibold leading-snug tracking-[-0.01em] hover:text-[color:var(--color-brand)]"
          >
            <TranslatedContent kind="place" id={place.id} field="name" text={place.name} toggle={false} />
          </Link>
          {place.isDonor && (
            <span className="rounded-full bg-[color:var(--color-success)]/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-success)]">
              {t("places.donates", "Donates")}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[12px] text-[color:var(--color-text-muted)]">
          {placeKindLabel(t, place.type)}
          {where ? ` · ${where}` : ""}
          {place.distanceKm !== null ? ` · ${place.distanceKm.toFixed(1)} km` : ""}
        </p>
        {place.summary && (
          <p className="mt-1 line-clamp-2 text-[13px] text-[color:var(--color-text-muted)]">
            <TranslatedContent kind="place" id={place.id} field="summary" text={place.summary} toggle={false} />
          </p>
        )}
        {place.needs && (
          <p className="mt-1 line-clamp-1 text-[12px] text-[color:var(--color-brand)]">
            {t("places.needs", "Needs: {what}", { what: place.needs })}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onToggleSave}
        aria-pressed={place.saved}
        aria-label={place.saved ? t("clip.unsave", "Remove from saved") : t("post.save", "Save")}
        className={`h-8 w-8 shrink-0 self-start rounded-full transition-colors duration-200 ${
          place.saved
            ? "text-[color:var(--color-brand)]"
            : "text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-brand)]"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill={place.saved ? "currentColor" : "none"} aria-hidden className="mx-auto">
          <path d="M6.5 4.5h11v15l-5.5-3.6-5.5 3.6v-15z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
