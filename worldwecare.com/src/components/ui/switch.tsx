"use client";

import { cn } from "@/lib/utils";

/**
 * Apple-style toggle switch. Controlled — pass `checked` +
 * `onChange`. Renders as a real button so it gets keyboard focus
 * and screen-reader semantics for free.
 *
 * The knob is the one white in this codebase that is not a mistake.
 * Everything else that was `bg-white` became `--color-surface` so it
 * follows dark mode; the knob must not, because in dark mode the
 * surface is near-black and a near-black knob on the grey OFF track
 * is invisible — the control would read as having no knob at all.
 * White clears both tracks, in both modes, which is the only thing
 * the knob has to do.
 */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full",
        "transition-colors duration-150",
        "focus:outline-none focus:ring-4 focus:ring-[color:var(--color-brand-soft)]",
        checked
          ? "bg-[color:var(--color-brand)]"
          : "bg-[color:var(--color-border-strong)] hover:bg-[color:var(--color-text-subtle)]",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow-sm",
          "transition-transform duration-150",
          checked ? "translate-x-[22px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}
