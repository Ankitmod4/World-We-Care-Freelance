"use client";

/**
 * The reaction control on a post.
 *
 * ONE TAP STILL WORKS. Tapping the button leaves the default 👍 —
 * everything a plain like button ever did, unchanged. The picker is an
 * addition on top: hover it on a mouse, hold it on a touchscreen.
 * Making the picker the only way in would turn a one-tap action into a
 * two-step one for the majority who just want to say "seen, and I'm
 * with you".
 *
 * HOLD, NOT LONG-PRESS-THEN-NAVIGATE. The press timer is cancelled on
 * move and on release, so a scroll that starts on the button does not
 * open a menu in somebody's face.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  REACTIONS,
  REACTION_BY_TYPE,
  type ReactionType,
} from "@/lib/reactions";
import { useT } from "./locale-context";
import { reactionAria, reactionLabel } from "@/lib/reaction-text";

export function ReactionButton({
  mine,
  count,
  onPick,
  disabled,
  placement = "top",
  size = "md",
}: {
  mine: ReactionType | null;
  count: number;
  onPick: (type: ReactionType) => void;
  disabled?: boolean;
  /**
   * "sm" for a comment row, where an 44px tall control next to
   * "Reply · Delete" would tower over the line it belongs to. The
   * picker itself stays full size — the targets you have to hit
   * accurately are the six emoji, not the button that opens them.
   */
  size?: "sm" | "md";
  /**
   * Which way the picker opens. The feed card sits in a long scroll
   * with room above it; the lightbox's action row is pinned near the
   * top of its panel, where opening upward would land on the author's
   * name. Nothing else about the control changes.
   */
  placement?: "top" | "bottom";
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set when the hold opened the picker, so the click that follows is ignored. */
  const heldOpen = useRef(false);

  const clearHold = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  }, [cancelClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  useEffect(() => () => {
    clearHold();
    cancelClose();
  }, [clearHold, cancelClose]);

  const chosen = mine ? REACTION_BY_TYPE[mine] : null;

  const pick = (type: ReactionType) => {
    setOpen(false);
    onPick(type);
  };

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => {
        if (!disabled) {
          cancelClose();
          setOpen(true);
        }
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={
          chosen
            ? t("reaction.change", "{name} — change or remove", { name: reactionLabel(t, chosen.type) })
            : t("reaction.pick", "React to this post")
        }
        aria-expanded={open}
        onPointerDown={() => {
          heldOpen.current = false;
          clearHold();
          holdTimer.current = setTimeout(() => {
            heldOpen.current = true;
            setOpen(true);
          }, 350);
        }}
        onPointerUp={clearHold}
        onPointerMove={clearHold}
        onPointerCancel={clearHold}
        onClick={() => {
          // The hold already opened the picker; the click that ends
          // the hold must not also toggle a reaction underneath it.
          if (heldOpen.current) {
            heldOpen.current = false;
            return;
          }
          pick(mine ?? "LIKE");
        }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-[10px] text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-text)]",
          size === "sm" ? "min-h-7 px-1.5" : "min-h-11 px-2.5",
          mine && "font-medium text-[color:var(--color-brand)]",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {/*
          NO WORDS. The emoji IS the label — "Sending love" written next
          to 🤗 is the same thing said twice, and six different word
          widths made the action row jump every time somebody changed
          their mind. The aria-label above carries the meaning for
          anyone who cannot see the emoji.
        */}
        {chosen ? (
          <span
            className={cn("leading-none", size === "sm" ? "text-[14px]" : "text-[17px]")}
            aria-hidden
          >
            {chosen.emoji}
          </span>
        ) : (
          <svg
            width={size === "sm" ? 14 : 18}
            height={size === "sm" ? 14 : 18}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0112 7a3.5 3.5 0 017 3.5c0 5-7 9.5-7 9.5z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {count > 0 && (
          <span
            className={cn(
              "tabular-nums font-medium",
              size === "sm" ? "text-[11.5px]" : "text-[12.5px]",
            )}
          >
            {count}
          </span>
        )}
      </button>

      {open && !disabled && (
        <div
          role="menu"
          aria-label={t("reaction.pickAria", "Pick a reaction")}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          className={cn(
            "absolute left-0 z-40 flex items-center gap-0.5 rounded-full border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] px-1.5 py-1 shadow-elevated",
            placement === "top" ? "bottom-full mb-1" : "top-full mt-1",
          )}
        >
          {REACTIONS.map((r) => (
            <button
              key={r.type}
              type="button"
              role="menuitem"
              title={reactionLabel(t, r.type)}
              aria-label={reactionAria(t, r.type)}
              onClick={(e) => {
                e.stopPropagation();
                pick(r.type);
              }}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-[19px] transition-transform hover:scale-125 hover:bg-[color:var(--color-surface-hover)] active:scale-110",
                mine === r.type && "bg-[color:var(--color-brand-soft)]",
              )}
            >
              <span aria-hidden className="leading-none">
                {r.emoji}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
