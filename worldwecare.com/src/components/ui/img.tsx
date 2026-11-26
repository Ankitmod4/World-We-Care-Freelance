"use client";

/**
 * The one <img> in the app.
 *
 * Four things this exists to stop being decided seventy times:
 *
 *  1. WHICH FILE. `variant="thumb"` swaps to the small copy generated
 *     at upload. A feed showing full-size originals in a 480px box is
 *     the whole reason the page felt slow.
 *  2. WHAT IF IT ISN'T THERE. `thumbUrlFor` is optimistic — it names a
 *     thumbnail that may not exist yet, for anything uploaded before
 *     the resizer or not yet backfilled. One `onError` swaps back to
 *     the original, so the worst case is one wasted 404 and the
 *     picture the person expected. Being conservative instead is what
 *     made the first version a no-op on every existing image.
 *
 *     A miss is remembered for the rest of the page's life, in the
 *     module-level set below. One avatar appears twenty times in a
 *     feed; without this, that is twenty identical 404s, and every
 *     scroll adds more. With it, the first one pays and the rest go
 *     straight to the original.
 *  3. WHEN IT LOADS. Lazy and async-decoded by default, so images
 *     below the fold do not compete with the ones on screen. Anything
 *     genuinely above the fold passes `priority`.
 *  4. WHAT SPACE IT TAKES. An `aspect` reserves the box before the
 *     bytes arrive, so nothing jumps as pictures land — which is what
 *     most of "slow" turns out to be.
 */

import { useEffect, useState } from "react";
import { thumbUrlFor } from "@/lib/image-urls";

/**
 * Thumbnails we have already asked for and been refused.
 *
 * Deliberately NOT consulted during the first render. This is a client
 * component, so it renders on the server too, where the module lives
 * for the life of the process and would answer differently from a
 * browser that has just loaded the page — a hydration mismatch. The
 * first paint always asks for the thumbnail; the effect below is what
 * uses this, after hydration, when a mismatch is no longer possible.
 *
 * Cleared by a page load, which is the right lifetime: run the
 * backfill and a refresh starts trusting thumbnails again.
 */
const missingThumbs = new Set<string>();

export interface ImgProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "loading"> {
  src: string | null | undefined;
  alt: string;
  /** "thumb" uses the small copy when one exists. Default "full". */
  variant?: "thumb" | "full";
  /** Above the fold: load eagerly and hint the browser to prioritise. */
  priority?: boolean;
  /** e.g. "16 / 9" or "1 / 1". Reserves the box before the image lands. */
  aspect?: string;
}

export function Img({
  src,
  alt,
  variant = "full",
  priority = false,
  aspect,
  className,
  style,
  onError,
  ...rest
}: ImgProps) {
  const wanted = variant === "thumb" ? (thumbUrlFor(src) ?? src) : src;
  const [current, setCurrent] = useState(wanted);

  // A different picture in the same slot — a feed re-render, a
  // lightbox stepping to the next image — must reset the fallback, or
  // the new image inherits the old one's failure. And on the way
  // through, skip a thumbnail this page has already been refused.
  useEffect(() => {
    setCurrent(wanted && missingThumbs.has(wanted) ? (src ?? wanted) : wanted);
  }, [wanted, src]);

  if (!src || !current) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : undefined}
      onError={(e) => {
        // Exactly one retry, and only ever back to the original. No
        // loop: once `current` is `src` there is nowhere left to fall.
        if (current !== src) {
          missingThumbs.add(current);
          setCurrent(src);
        }
        onError?.(e);
      }}
      className={className}
      style={aspect ? { aspectRatio: aspect, ...style } : style}
      {...rest}
    />
  );
}
