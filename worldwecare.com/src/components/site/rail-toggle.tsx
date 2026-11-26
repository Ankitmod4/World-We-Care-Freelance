"use client";

/**
 * The right rail's show/hide control.
 *
 * ITS OWN FILE so the harness can render the REAL one. It lived inside
 * site-shell, which meant the visual check had to re-type the markup,
 * and a re-typed copy is exactly how a broken icon ships looking fine
 * in a screenshot.
 */

import { useT } from "./locale-context";

/**
 * Show/hide the right rail.
 *
 * Two instances of this exist at once — one inside the panel, one on
 * the edge — because the control has to be reachable in BOTH states
 * and CSS decides which is on screen. `open` says which one this is,
 * not what the current state is.
 */
export function RailToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  const t = useT();
  const hint = open
    ? t("rail.hidePanel", "Hide the side panel")
    : t("rail.showPanel", "Show the side panel");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls="wwc-right-rail"
      title={hint}
      className={
        "inline-flex items-center justify-center border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-subtle)] transition-colors hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)] " +
        (open
          ? "h-7 w-7 rounded-[9px]"
          : // A HANDLE, NOT A BUTTON. Flat against the right edge with
            // no border on that side, so it reads as the hidden panel's
            // pull-tab rather than something floating in the margin.
            "h-11 w-7 rounded-l-[10px] border-r-0 shadow-card")
      }
    >
      {/*
        A DOUBLE CHEVRON, pointing the way the panel will move.

        Two icons were tried before this. A chevron drawn over a
        vertical rule overlapped into a smudge at 14px — the chevron
        ended at x=17 and the rule sat at x=16. A panel-frame glyph
        with one pane filled was legible but read as an icon you have
        to learn.

        Guillemets are the one collapse affordance nobody has to
        decode, and they carry direction on their own: » pushes the
        panel out to the right, « pulls it back in. No overlapping
        strokes at any size.
      */}
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
        {(open ? [8, 14.5] : [15.5, 9]).map((x, i) => (
          <path
            key={i}
            d={open ? `M${x} 6.5L${x + 5} 12l-5 5.5` : `M${x} 6.5L${x - 5} 12l5 5.5`}
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <span className="sr-only">{hint}</span>
    </button>
  );
}

