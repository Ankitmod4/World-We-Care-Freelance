"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "./locale-context";

const EMOJIS = [
  "😀","😊","😅","😂","🥹","😍","😉","😎","🤔","🙂","😌","😴",
  "😢","😭","😳","😡","🥺","🤗","🫶","🙏","👍","👎","👏","🙌",
  "💪","🤝","🫂","❤️","🧡","💛","💚","💙","💜","🤍","💔","✨",
  "🎉","🔥","🌟","⭐","🌈","☀️","🌸","🌿","🍀","☕","🎁","💯",
];

/** Lightweight emoji picker — a smiley button + popover grid. No
 *  external library, so it stays out of the bundle budget. */
export function EmojiPicker({ onPick, keepOpen }: { onPick: (emoji: string) => void; keepOpen?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("common.emoji", "Emoji")}
        className="inline-flex items-center justify-center h-9 w-9 rounded-[10px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)] hover:bg-[color:var(--color-surface-hover)]"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M7 12c.7 1 1.8 1.6 3 1.6s2.3-.6 3-1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="7.5" cy="8" r="0.9" fill="currentColor" />
          <circle cx="12.5" cy="8" r="0.9" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 left-0 z-20 w-[248px] max-h-56 overflow-y-auto rounded-[14px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)] p-2 grid grid-cols-8 gap-0.5">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onPick(e);
                if (!keepOpen) setOpen(false);
              }}
              className="h-7 w-7 flex items-center justify-center text-[18px] rounded-[8px] hover:bg-[color:var(--color-surface-hover)]"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
