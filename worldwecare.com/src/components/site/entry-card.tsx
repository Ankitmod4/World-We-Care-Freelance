"use client";

/**
 * One tile on the gratitude or confession wall.
 *
 * FIXED HEIGHT, ALTERNATING. Every tile is one of two heights, short
 * and tall, alternating down the wall. That is what makes it read as a
 * deliberate brick pattern rather than a ragged column of whatever
 * length people happened to write — which is what it looked like when
 * each tile grew to fit its text.
 *
 * The alternation is computed from the index and passed in, NOT done
 * with `nth-child`. In a CSS column layout `nth-child` counts DOM
 * order, which runs down each column in turn, so the pattern would
 * break at every column boundary in a way nobody could debug.
 *
 * THE TEXT IS CLAMPED, NOT SHORTENED. `line-clamp` leaves the full
 * text in the DOM — copy-paste, find-in-page and screen readers all
 * still get the whole thing, and the entry's own page shows it in
 * full. Truncating the string server-side would have taken it away
 * from all three.
 *
 * TAPPING THE BODY OPENS THE ENTRY; the footer does not. A card
 * wrapped entirely in a link makes the reaction button a navigation,
 * and a picker that opens and then leaves the page is worse than no
 * picker. So the link covers the author, text and photo, and the
 * controls sit outside it.
 */

import Link from "next/link";
import { Img } from "@/components/ui/img";
import { timeAgo } from "@/lib/time-ago";
import { useT } from "./locale-context";
import { useTranslatedContent } from "./translated-content";
import { durationBadge } from "@/lib/duration";
import type { ContentKind } from "@/lib/content-kinds";
import type { AttachedVideo } from "@/lib/attached-media";

/**
 * Short and tall. Two heights, not three — a pattern needs to repeat.
 *
 * THESE NUMBERS ARE ARITHMETIC, not taste, and they are worked out
 * against a line height of exactly 22px — see LINE below, which is
 * why that is pinned rather than left to `leading-relaxed`.
 *
 * Working down from the short card:
 *
 *     356  the card
 *    − 52  the footer (8 top pad + 32 control + 12 bottom pad)
 *    − 16  the body's own top padding
 *    ─────
 *     288  for the content
 *    − 32  the author row
 *    − 10  its margin
 *    ─────
 *     246  for a text-only card: eleven lines, with 4px spare
 *    −160  the square, when there is one
 *    − 10  its margin
 *    ─────
 *      76  three lines, with 10px spare
 *
 * The tall card adds 88 — four more lines either way.
 *
 * THE SPARE PIXELS ARE THE POINT. The first version of this left
 * exactly two lines' worth and nothing over, and the second line came
 * out clipped through its descenders: a clamp box that is precisely
 * n × line-height has no room for the sub-pixel rounding a real
 * layout does. Every number above now leaves at least 4px.
 *
 * AND THE LINE COUNTS ARE MEASURED, NOT DERIVED. The arithmetic above
 * says a text-only card has 246px to play with; the browser says 239,
 * because the footer is a few pixels taller than the sum of its
 * declared paddings. So the clamps are 10 and 14 rather than the 11
 * and 15 this working predicts, and the walls harness asserts no
 * clamp box is taller than the space it sits in — the number that
 * matters is the one the layout actually produces.
 */
const HEIGHTS = ["h-[356px]", "h-[444px]"] as const;

/**
 * The line height every calculation above depends on.
 *
 * Pinned to a whole number because `leading-relaxed` on 13.5px text is
 * 21.9375px, and `line-clamp` cuts at n × that — so the box is a
 * fraction short of the lines it is meant to hold and the last one
 * loses its descenders. An integer makes the arithmetic exact.
 */
const LINE = "text-[13.5px] leading-[22px]";

export function cardIsTall(index: number): boolean {
  return index % HEIGHTS.length === 1;
}

/**
 * A WALL, NOT A LIST — the class the three pages that draw one share.
 *
 * It used to be copied into gratitude-client, confessions-client and
 * the category page, which is three places to change a number that
 * has to be the same in all of them.
 *
 * `columns-[240px]` sets a column WIDTH and lets the browser fit as
 * many as the space allows, so the count follows the container rather
 * than a guessed breakpoint. The content column is 800px at 1440 and
 * up (with the right rail) and 640px at exactly 1280 — a viewport
 * breakpoint gets this wrong at both ends, because a NARROWER viewport
 * can have a WIDER column when a rail drops out. 240 is chosen so 800
 * fits three: (800 + 16 gap) / (240 + 16) = 3.19.
 *
 * CSS COLUMNS, NOT GRID, because the tiles are two different heights.
 * Grid would leave ragged gaps. The cost is reading order: a column
 * wall reads down, not across, so the second-newest entry sits below
 * the newest rather than beside it. That is the Pinterest convention
 * and it is what "wall" means here; a list that has to be read in
 * order is what the feed is for.
 *
 * `break-inside-avoid` on each card — see EntryCardShell — is what
 * stops one being sliced across a column boundary.
 */
export const WALL = "[column-fill:balance] gap-4 columns-[240px]";

export function EntryCardShell({
  index,
  href,
  children,
  footer,
}: {
  index: number;
  /**
   * Null for an entry that has no page to open — your own post still
   * waiting on a moderator. Linking it would send the author to a
   * "not available" screen for something they can see right here.
   */
  href: string | null;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const t = useT();
  /*
    `min-h-0` is what lets this shrink inside a fixed-height flex
    column. Without it the body keeps its content height, the footer is
    pushed out of the bottom of the card, and the reaction button is
    unreachable.
  */
  // `flex flex-col` so the photo inside can be the thing that gives
  // way — see EntryCardBody.
  const bodyClass = "flex min-h-0 flex-1 flex-col overflow-hidden p-4 pb-0";

  return (
    <div
      className={
        // NO `overflow-hidden` here, however much the rounded corners
        // want it: the reaction picker is an absolutely positioned
        // popover anchored in the footer, and a clipping ancestor
        // would cut it off at the card's edge. The body clips itself
        // instead, and its padding keeps content off the corners.
        // The confession wall used to draw a 3px brand stripe down the
        // left of every tile. It was doing the work of a label nobody
        // needed — you are on the confession wall, you know what these
        // are — and with the tiles at 240px it read as a line the text
        // had to get past.
        "mb-4 flex break-inside-avoid flex-col rounded-[16px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-[var(--shadow-card)] " +
        HEIGHTS[index % HEIGHTS.length]
      }
    >
      {href ? (
        <Link href={href} className={bodyClass}>
          {children}
        </Link>
      ) : (
        <div className={bodyClass}>{children}</div>
      )}
      <div className="shrink-0 px-4 pb-3 pt-2">{footer}</div>
    </div>
  );
}

export function EntryCardBody({
  authorName,
  authorAvatar,
  isAnonymous,
  body,
  imageUrl,
  video,
  createdAt,
  tall,
  quoted,
  contentKind,
  contentId,
}: {
  authorName: string;
  authorAvatar: string | null;
  isAnonymous: boolean;
  body: string;
  imageUrl: string | null;
  /**
   * The attached video, if there is one. An entry has a photo OR a
   * video, never both — the libs refuse the pair — so these two share
   * the one square below rather than competing for it.
   */
  video?: AttachedVideo | null;
  createdAt: string;
  /**
   * Whether this card got the tall height. Decides how many lines of
   * text fit — see the clamp below. `cardIsTall(index)` is the answer;
   * it is passed in rather than recomputed so the shell and the body
   * cannot disagree about which card this is.
   */
  tall?: boolean;
  /** The confession wall renders its text as a quote. */
  quoted?: boolean;
  /**
   * What this card is, so the text can be translated.
   *
   * NO "Show original" HERE, deliberately. The whole card is a link to
   * the entry's own page, the text is clamped to three or four lines
   * anyway, and a button inside a link is a thing people press by
   * accident. The toggle lives on the page the card opens.
   */
  contentKind?: ContentKind;
  contentId?: string;
}) {
  const t = useT();
  const bodyT = useTranslatedContent(contentKind ?? "post", contentId ?? "", "body", body);
  const initials = authorName
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <span className="flex shrink-0 items-center gap-2.5">
        {authorAvatar ? (
          <Img src={authorAvatar} alt="" variant="thumb" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span
            className={
              "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold " +
              (isAnonymous
                ? "bg-[color:var(--color-text)] text-[color:var(--color-surface)]"
                : "bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)]")
            }
          >
            {isAnonymous ? "··" : initials}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold">{authorName}</span>
          <span className="block text-[11.5px] text-[color:var(--color-text-subtle)]">
            {timeAgo(t, createdAt)}
          </span>
        </span>
      </span>

      {/*
        A SQUARE, AND CAPPED AT 160.

        It used to be `flex-1` — whatever height was left over — which
        made it a different rectangle in every card and, on a wall,
        read as an accident. A square is one shape, and a grid of them
        is a pattern.

        The cap is what makes a fixed card height possible at all. A
        full-width square is as tall as the column is wide, and the
        column is 246px at one breakpoint and 366px at another (the
        wall sizes to its container, not the viewport) — so an
        uncapped square would need a card 120px taller on a phone than
        on a laptop, and the heights above could not be numbers. At
        160 it is essentially full-bleed in the narrow columns where
        most cards live, and insets slightly in the wide ones, which
        centring makes read as deliberate. It was 180 first; the extra
        20px came off so the text under it gets three lines instead of
        a cramped two.

        `object-cover`, so a portrait or a panorama is cropped to the
        square rather than letterboxed into it.
      */}
      {imageUrl && (
        <span className="mt-2.5 block w-full max-w-[160px] shrink-0 self-center overflow-hidden rounded-[12px] bg-[color:var(--color-surface-muted)]">
          <Img src={imageUrl} alt="" variant="thumb" className="aspect-square h-full w-full object-cover" />
        </span>
      )}

      {/*
        A VIDEO GETS THE SAME SQUARE — AS A POSTER, NOT A PLAYER.

        NO <video> ELEMENT HERE, and not for weight: this whole block
        sits inside the card's <Link>, and a player's controls inside a
        link are unusable. Every press of play, pause or the scrubber
        navigates away instead. That is the same rule the footer
        already follows by sitting outside the link — see the note at
        the top of this file.

        So the card shows the frame ffmpeg pulled at 10% of the way in
        (see `posterAt` in lib/video.ts) with a play badge over it, and
        tapping anywhere opens the entry's page, where the real player
        lives. A thumbnail with a play button on it is also what every
        other wall of videos looks like, so it needs no explaining.

        WITHOUT A POSTER it is a filled tile rather than a broken
        frame. An asset only reaches READY with a poster, so this is
        the defensive branch for a row written before that was true, or
        one edited by hand — the same reason `readVideo` tolerates a
        missing one.

        `pointer-events-none` on the overlay so the badge can never eat
        the tap that is meant for the link underneath it.
      */}
      {!imageUrl && video && (
        <span className="relative mt-2.5 block w-full max-w-[160px] shrink-0 self-center overflow-hidden rounded-[12px] bg-[color:var(--color-text)]">
          {video.posterUrl ? (
            <Img
              src={video.posterUrl}
              alt=""
              variant="thumb"
              className="aspect-square h-full w-full object-cover"
            />
          ) : (
            <span className="block aspect-square h-full w-full" />
          )}

          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 backdrop-blur-[2px]">
              {/* A triangle, drawn rather than a glyph, so it is
                  centred optically — the ▶ character sits low in its
                  em box and reads as falling out of the circle. */}
              <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden>
                <path d="M2 1.6v12.8L12.4 8 2 1.6z" fill="#fff" />
              </svg>
            </span>
          </span>

          {durationBadge(video.durationSec) && (
            <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-full bg-black/65 px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums text-white">
              {durationBadge(video.durationSec)}
            </span>
          )}
        </span>
      )}

      {/*
        PLAIN TEXT, not <RichText>. RichText turns markdown links into
        real <a> elements, and this whole block sits inside the card's
        <Link> — an anchor inside an anchor is invalid HTML, and React
        hydration says so out loud. The preview only needs the words;
        the entry's own page renders the links.
      */}
      {/*
        THE TEXT FILLS WHAT IS LEFT, and sits in the middle of it —
        UNLESS it is too long to fit, in which case it starts at the
        top.
      
        That "unless" is the whole reason `safe` is here, and it is not
        a nicety. Plain `align-items: center` on content taller than
        its box centres the OVERFLOW: the excess is split evenly, so
        the first lines are pushed up out of view and a long confession
        opens mid-sentence with no way to see its beginning. Every
        long post on the wall was showing its middle. `safe` says
        "centre it, but never at the cost of the start", and falls back
        to flex-start the moment the content does not fit.
      
        Written as an arbitrary property rather than `items-center`
        because Tailwind has no class for the safe keyword — and a
        browser too old to understand it drops the declaration and
        inherits `stretch`, which top-aligns. The failure mode is the
        conservative one.

        `min-h-0` because a flex child will not shrink below its
        content without it.
      */}
      <span className="mt-2.5 flex min-h-0 flex-1 overflow-hidden [align-items:safe_center]">
        {/*
          NO `block` HERE, however much it looks like it belongs.

          `line-clamp-*` works by setting `display: -webkit-box` — that
          is the only display in which `-webkit-line-clamp` does
          anything at all. Tailwind emits `.block` after it, so adding
          `block` to the same element silently wins the cascade and the
          clamp becomes inert: `-webkit-line-clamp: 3` sits in the
          computed style looking correct while the element renders at
          its full 22-line height.

          That is what was actually wrong with the confession wall. The
          overflow was hidden by the wrapper, so it read as "the text
          starts in the middle" rather than as "the clamp is off", and
          the computed style agreed with the class name the whole time.
        */}
        <span
          className={
            "w-full whitespace-pre-wrap break-words text-[color:var(--color-text)] " +
            LINE +
            " " +
            // Four numbers, from the arithmetic beside HEIGHTS. One
            // number would either clip the short card or leave the
            // tall one two-thirds empty.
            //
            // A VIDEO POSTER IS THE SAME 160px SQUARE as a photo, so
            // it costs the text exactly the same lines. Reading this
            // off `imageUrl` alone — which is what it did first — left
            // a video card claiming eleven lines of room in a box that
            // had three, and the clamp cut the text off mid-word with
            // no overflow to show for it.
            (imageUrl || video
              ? tall
                ? "line-clamp-[7]"
                : "line-clamp-3"
              : tall
                ? "line-clamp-[14]"
                : "line-clamp-[10]") +
            (quoted ? " italic" : "")
          }
        >
          {contentId ? bodyT.text : body}
        </span>
      </span>
    </>
  );
}
