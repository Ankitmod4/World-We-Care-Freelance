"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Img } from "@/components/ui/img";

interface Img {
  url: string;
  alt?: string | null;
}

/**
 * Post image renderer for the admin surfaces (moderation list +
 * detail). A lone image renders uncropped; multiple images show as a
 * tidy cover-cropped grid. Any image opens a full-screen lightbox so
 * a moderator can always see the whole picture — nothing is judged
 * off a cropped thumbnail.
 */
export function PostImages({
  images,
  limit,
  thumbHeightClass = "h-40",
  singleMaxHClass = "max-h-[520px]",
}: {
  images: Img[];
  limit?: number;
  thumbHeightClass?: string;
  singleMaxHClass?: string;
}) {
  const [index, setIndex] = useState<number | null>(null);
  if (images.length === 0) return null;

  const shown = limit ? images.slice(0, limit) : images;
  const extra = limit && images.length > limit ? images.length - limit : 0;

  return (
    <>
      {images.length === 1 ? (
        <button
          type="button"
          onClick={() => setIndex(0)}
          className="block w-full overflow-hidden rounded-[10px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] cursor-zoom-in"
        >
          <Img
            src={images[0].url}
            alt={images[0].alt ?? ""}
            className={cn("w-full object-contain", singleMaxHClass)}
          />
        </button>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {shown.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              className="relative block cursor-zoom-in"
            >
              <Img
                src={img.url}
                alt={img.alt ?? ""}
                className={cn(
                  "w-full object-cover rounded-[10px] border border-[color:var(--color-border-soft)]",
                  thumbHeightClass,
                )}
              />
              {extra > 0 && i === shown.length - 1 && (
                <span className="absolute inset-0 flex items-center justify-center rounded-[10px] bg-black/50 text-white text-[16px] font-semibold">
                  +{extra}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {index !== null && (
        <ImageLightbox images={images} startIndex={index} onClose={() => setIndex(null)} />
      )}
    </>
  );
}

function ImageLightbox({
  images,
  startIndex,
  onClose,
}: {
  images: Img[];
  startIndex: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(Math.min(Math.max(0, startIndex), images.length - 1));
  const many = images.length > 1;
  const prev = () => setI((v) => (v - 1 + images.length) % images.length);
  const next = () => setI((v) => (v + 1) % images.length);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && many) prev();
      else if (e.key === "ArrowRight" && many) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [many, images.length, onClose]);

  const current = images[i];

  return (
    <div className="fixed inset-0 z-[70] flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-3 right-3 z-20 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      <div className="relative z-10 m-auto flex items-center justify-center w-full h-full p-4">
        {current && (
          <Img
            src={current.url}
            alt={current.alt ?? ""}
            className="max-h-[90vh] max-w-full w-auto object-contain select-none"
          />
        )}

        {many && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {images.map((_, d) => (
                <span
                  key={d}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    d === i ? "w-4 bg-[color:var(--color-surface)]" : "w-1.5 bg-white/50",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
