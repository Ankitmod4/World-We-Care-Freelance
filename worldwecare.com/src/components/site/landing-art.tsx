/**
 * Artwork and icons for the signed-out landing page.
 *
 * Everything here is drawn in the file rather than loaded as an asset,
 * for three reasons: it costs no extra request, it recolours itself
 * with the member's theme (the palettes are injected as CSS variables,
 * so a flat PNG would be the one thing on the page that ignores dark
 * mode), and it can't 404 on the first page a stranger ever sees.
 *
 * Photographs, when there are any, layer on top — see `Photo` below.
 */

import fs from "node:fs";
import path from "node:path";
import { getT } from "@/lib/i18n";

/* ── icons ───────────────────────────────────────────────────── */

export type LandingIconName =
  | "eye"
  | "ask"
  | "people"
  | "envelope"
  | "pin"
  | "mask"
  | "toggle"
  | "shield"
  | "book";

const PATHS: Record<LandingIconName, React.ReactNode> = {
  // Reading. Deliberately the friendliest possible eye — this sits on
  // "nobody is notified that you are here", so it must read as "you can
  // look" and not as "you are being watched".
  eye: (
    <>
      <path d="M2.6 12S6.2 6 12 6s9.4 6 9.4 6-3.6 6-9.4 6-9.4-6-9.4-6z" />
      <circle cx="12" cy="12" r="2.9" />
    </>
  ),
  // A question inside a bubble: one small ask, not a conversation.
  ask: (
    <>
      <path d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v7a2.5 2.5 0 01-2.5 2.5H9.5L5 19.5V16h1.5A2.5 2.5 0 014 13.5v-7z" />
      <path d="M10.1 8.6a2 2 0 113 1.8c-.55.28-.85.72-.85 1.25v.35" />
      <path d="M12.25 14.2v.01" strokeWidth="2.1" />
    </>
  ),
  people: (
    <>
      <circle cx="9.2" cy="9.4" r="3.1" />
      <path d="M3.6 19.2a5.6 5.6 0 0111.2 0" />
      <circle cx="17.3" cy="10.4" r="2.3" />
      <path d="M16.4 15.1a4.3 4.3 0 014 4.1" />
    </>
  ),
  envelope: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3.8 7.2l7.1 5.2a2 2 0 002.2 0l7.1-5.2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 20.5s6.5-5.6 6.5-10.7A6.5 6.5 0 105.5 9.8C5.5 14.9 12 20.5 12 20.5z" />
      <circle cx="12" cy="9.8" r="2.4" />
    </>
  ),
  // A person whose head is dashed: there is somebody there, you just
  // don't get their name. A face-covering mask was the first draft and
  // read as a smiley in a box — worse, "masked" suggests hiding from
  // moderators too, which is exactly the thing this section denies.
  mask: (
    <>
      <circle cx="12" cy="8" r="3.6" strokeDasharray="2.6 2.3" />
      <path d="M4.8 19.6a7.2 7.2 0 0114.4 0" />
    </>
  ),
  toggle: (
    <>
      <rect x="2.8" y="7" width="18.4" height="10" rx="5" />
      <circle cx="16.2" cy="12" r="2.9" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.4l7 2.6v5.3c0 4.2-2.9 7.6-7 9.3-4.1-1.7-7-5.1-7-9.3V6l7-2.6z" />
      <path d="M8.9 11.9l2.2 2.2 4-4.3" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.3A1.3 1.3 0 015.3 4h4.4A2.3 2.3 0 0112 6.3v13a2 2 0 00-2-2H4V5.3z" />
      <path d="M20 5.3A1.3 1.3 0 0018.7 4h-4.4A2.3 2.3 0 0012 6.3v13a2 2 0 012-2h6V5.3z" />
    </>
  ),
};

export function LandingIcon({
  name,
  size = 22,
  className,
}: {
  name: LandingIconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

/* ── the hero illustration ───────────────────────────────────── */

/**
 * Seven people standing around a heart.
 *
 * Positions are computed rather than typed out so the ring stays even
 * if the count changes, and the two tints alternate so it reads as a
 * mixed group rather than a logo.
 */
const RING_COUNT = 7;
/* Slight size differences. Seven identical silhouettes at identical
   spacing looks like a logo; a few percent of variation looks like
   people standing near each other. */
const SCALES = [1, 0.89, 1.06, 0.93, 1.02, 0.87, 0.97];
const FIGURES = Array.from({ length: RING_COUNT }, (_, i) => {
  const angle = (i / RING_COUNT) * Math.PI * 2 - Math.PI / 2;
  return {
    i,
    x: 200 + Math.cos(angle) * 138,
    y: 200 + Math.sin(angle) * 138,
    s: SCALES[i],
    accent: i % 3 === 1,
  };
});

export async function CommunityArt({ className }: { className?: string }) {
  const t = await getT();
  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      role="img"
      aria-label={t("landing.artAria", "A circle of people around a heart")}
    >
      <defs>
        <radialGradient id="wwc-glow" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="var(--color-brand-tint)" />
          <stop offset="55%" stopColor="var(--color-brand-soft)" />
          <stop offset="100%" stopColor="var(--color-brand-soft)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="wwc-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-surface)" stopOpacity="0.75" />
          <stop offset="60%" stopColor="var(--color-surface)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--color-surface)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="wwc-heart" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand)" />
          <stop offset="100%" stopColor="var(--color-brand-hover)" />
        </linearGradient>
      </defs>

      <circle cx="200" cy="196" r="196" fill="url(#wwc-glow)" />

      {/* The ring is dashed, not solid: a circle you can step into. */}
      <circle
        cx="200"
        cy="200"
        r="138"
        fill="none"
        stroke="var(--color-brand)"
        strokeOpacity="0.28"
        strokeWidth="2"
        strokeDasharray="2 10"
        strokeLinecap="round"
      />

      {/* Lifts the heart off the wash. It has to fade out at the edge —
          a flat disc draws its own hard circle and the whole thing
          starts to look like a target. */}
      <circle cx="200" cy="200" r="86" fill="url(#wwc-halo)" />

      <g transform="translate(200 200) scale(3.1) translate(-12 -12)">
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill="url(#wwc-heart)"
        />
      </g>

      {FIGURES.map((f) => (
        <g
          key={f.i}
          transform={`translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) scale(${f.s})`}
          fill={f.accent ? "var(--color-accent)" : "var(--color-brand)"}
          opacity={f.accent ? 0.75 : 0.9}
        >
          <circle cx="0" cy="-8" r="12.5" />
          <path d="M-19 32a19 19 0 0138 0z" />
        </g>
      ))}
    </svg>
  );
}

/* ── optional photography ────────────────────────────────────── */

/**
 * Drop real photographs into `public/landing/` and they appear; leave
 * it empty and the page falls back to the artwork above.
 *
 * The existence check is deliberate. The alternative — hard-coding an
 * <img> and hoping — puts a broken-image glyph on the front door, and
 * hotlinking someone else's CDN puts every visitor's IP in a third
 * party's logs on the page where we promise we are careful with them.
 *
 * Server component, so this runs at request time on the server and
 * never ships the filesystem check to the browser.
 */
const PHOTO_DIR = path.join(process.cwd(), "public", "landing");
const EXTENSIONS = ["webp", "jpg", "jpeg", "png"];

/**
 * `findPhoto("hero")` → "/landing/hero.webp" if that file is on disk,
 * else the .jpg, else null. Extension order is preference order, so
 * dropping in both a .webp and a .jpg serves the smaller one.
 */
const resolved = new Map<string, string | null>();

function findPhoto(base: string): string | null {
  // public/ does not change while the server is up, so the answer is
  // the same for every request — look once per process rather than
  // stat-ing the disk on every visit to the front page.
  const cached = resolved.get(base);
  if (cached !== undefined) return cached;

  let hit: string | null = null;
  for (const ext of EXTENSIONS) {
    try {
      if (fs.existsSync(path.join(PHOTO_DIR, `${base}.${ext}`))) {
        hit = `/landing/${base}.${ext}`;
        break;
      }
    } catch {
      /* unreadable public dir — fall through to the artwork */
    }
  }
  resolved.set(base, hit);
  return hit;
}

/**
 * The hero picture. A photograph at `public/landing/hero.jpg` wins;
 * with nothing there, the drawing above stands in — so the page is
 * never waiting on an asset to look finished.
 */
export function HeroVisual({ className }: { className?: string }) {
  const src = findPhoto("hero");

  if (!src) return <CommunityArt className={className} />;

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-[28px] border border-[color:var(--color-border-soft)] shadow-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="aspect-[4/5] w-full object-cover"
          /* Above the fold on every visit — never lazy. */
          fetchPriority="high"
        />
      </div>
    </div>
  );
}

/**
 * Three photographs under the topic list, or nothing at all.
 *
 * Nothing at all is the important half. Grey placeholder boxes on the
 * front door say "unfinished" louder than an absent row ever does, so
 * this renders only once the files are actually there — and only if
 * all three are, because two-of-three leaves a hole in the grid.
 */
const STRIP = ["1", "2", "3"];

export function PhotoStrip({ className }: { className?: string }) {
  const found = STRIP.map(findPhoto);
  if (found.some((f) => f === null)) return null;

  return (
    <div className={`grid gap-4 sm:grid-cols-3 ${className ?? ""}`}>
      {found.map((src) => (
        <div
          key={src}
          className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src as string}
            alt=""
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] w-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}
