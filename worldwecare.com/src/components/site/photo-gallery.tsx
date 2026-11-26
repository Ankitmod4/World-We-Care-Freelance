"use client";

/**
 * Event photo gallery + lightbox.
 *
 * Photos used to be plain `target="_blank"` links, which dumped the
 * reader on a raw image URL with no way back. This keeps them in the
 * page: click to open, arrow keys or the on-screen arrows to move,
 * Escape or a click on the backdrop to close.
 *
 * `PhotoLightbox` is the viewer on its own, so a single image — the
 * event cover, say — can open the same way without pretending to be a
 * grid.
 */

import { useCallback, useEffect, useState } from "react";
import { Img } from "@/components/ui/img";
import { useT } from "./locale-context";

export interface GalleryImage {
  url: string;
  alt?: string;
}

export function PhotoLightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: GalleryImage[];
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  const count = photos.length;

  const step = useCallback(
    (delta: number) => {
      if (count < 2) return;
      onIndex((index + delta + count) % count);
    },
    [count, index, onIndex],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    // Stop the page behind from scrolling while the viewer is open.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, step]);

  const photo = photos[index];
  if (!photo) return null;

  const arrow =
    "flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors duration-200 hover:bg-white/20";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.alt || t("gallery.photo", "Photo")}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-3 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t("common.close", "Close")}
        className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors duration-200 hover:bg-white/20"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {count > 1 && (
        <span className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium tabular-nums text-white backdrop-blur">
          {index + 1} / {count}
        </span>
      )}

      <div className="flex w-full max-w-6xl items-center gap-2 sm:gap-4">
        {count > 1 && (
          <button type="button" onClick={() => step(-1)} aria-label={t("gallery.previous", "Previous photo")} className={`${arrow} shrink-0`}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        <figure className="min-w-0 flex-1 text-center">
          <Img
            src={photo.url}
            alt={photo.alt ?? ""}
            className="mx-auto max-h-[80vh] w-auto max-w-full rounded-lg object-contain"
          />
          {photo.alt && (
            <figcaption className="mt-3 text-[13px] text-white/70">{photo.alt}</figcaption>
          )}
        </figure>

        {count > 1 && (
          <button type="button" onClick={() => step(1)} aria-label={t("gallery.next", "Next photo")} className={`${arrow} shrink-0`}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * THUMBNAILS SIZE TO THE CONTAINER, NOT TO A BREAKPOINT.
 *
 * This used to be `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`, which
 * fixes the NUMBER of tiles and lets each one grow to whatever is
 * left. On a detail page with the right rail collapsed the content
 * column is about 1340px, so four tiles meant four 320px squares —
 * photographs the size of the article they illustrate.
 *
 * A viewport breakpoint cannot fix that: collapsing the rail changes
 * the column width without changing the viewport at all, so there is
 * no breakpoint to hang it on. `auto-fill` with a minimum instead
 * fixes the tile SIZE and lets the count follow the width — about 3
 * across on a phone, about 11 in a wide collapsed-rail column, and
 * roughly 110px either way. Same rule the campaign grid already uses,
 * and for the same reason.
 *
 * NO TWO-ROW CAP ANY MORE, and the `+N` badge went with it. Both
 * existed because 320px tiles made ten photos three tall rows of
 * page. At this size ten photos is one row on a desktop and four
 * short rows on a phone, so there is no length to defend against —
 * and the badge could not survive the change anyway: its count was
 * computed from the columns-per-breakpoint, and the column count is
 * no longer something CSS knows in advance.
 */

/** A grid of thumbnails that opens the lightbox on click. */
export function PhotoGallery({ photos }: { photos: GalleryImage[] }) {
  const t = useT();
  const [open, setOpen] = useState<number | null>(null);
  if (!photos.length) return null;

  const total = photos.length;

  return (
    <>
      <ul className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(104px,1fr))]">
        {photos.map((photo, i) => {
          return (
          <li key={`${photo.url}-${i}`}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={t("gallery.openPhoto", "Open photo {n} of {total}", { n: i + 1, total })}
              className="group block aspect-square w-full overflow-hidden rounded-xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] transition-shadow duration-200 hover:shadow-elevated"
            >
              <Img
                src={photo.url}
                alt={photo.alt ?? ""}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
            </button>
          </li>
          );
        })}
      </ul>

      {open !== null && (
        <PhotoLightbox
          photos={photos}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

/** A single image that opens in the lightbox — used for the cover. */
export function LightboxImage({
  photo,
  className,
  imgClassName,
}: {
  photo: GalleryImage;
  className?: string;
  imgClassName?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("gallery.open", "Open photo")}
        className={`group block w-full overflow-hidden ${className ?? ""}`}
      >
        <Img
          src={photo.url}
          alt={photo.alt ?? ""}
          className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] ${imgClassName ?? ""}`}
        />
      </button>
      {open && (
        <PhotoLightbox photos={[photo]} index={0} onIndex={() => {}} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
