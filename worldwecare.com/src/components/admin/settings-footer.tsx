"use client";

/**
 * Shared sticky footer for the /admin/settings/* forms.
 *
 * Replaces a per-page copy that swapped a line of grey text for the
 * word "Saved." at the far left of a wide bar, while the eye was on
 * the button at the far right. Nothing moved, nothing animated, and a
 * second save changed nothing visible — so it read as "clicking Save
 * does nothing".
 *
 * What this does instead:
 *  • confirms where the click happened — the button itself becomes
 *    "Saved ✓" for a moment;
 *  • pops a status pill that is re-keyed per save, so the animation
 *    replays every time rather than only on the first;
 *  • lets success fade back to the hint after a few seconds, while
 *    errors stay until the next attempt;
 *  • announces both to screen readers.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function SettingsFooter({
  saving,
  savedAt,
  error,
  hint,
  /** How long the success state stays before fading back to the hint. */
  successMs = 4000,
}: {
  saving: boolean;
  /** Timestamp of the last successful save — change it on every save. */
  savedAt: number | null;
  error: string | null;
  hint?: string;
  successMs?: number;
}) {
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!savedAt) return;
    setShowSuccess(true);
    const t = setTimeout(() => setShowSuccess(false), successMs);
    return () => clearTimeout(t);
  }, [savedAt, successMs]);

  return (
    <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-[color:var(--color-border-soft)] frost-strong px-4 py-3  sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="min-w-0 flex-1 text-[13px]">
        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-[10px] bg-[color:var(--color-danger)]/10 px-2.5 py-1.5 text-[color:var(--color-danger)]"
          >
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden className="mt-0.5 shrink-0">
              <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 6v4.5M10 13.5v.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <span className="font-medium">{error}</span>
          </p>
        ) : saving ? (
          <p role="status" className="flex items-center gap-2 text-[color:var(--color-text-muted)]">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[color:var(--color-border)] border-t-[color:var(--color-brand)]" />
            Saving…
          </p>
        ) : showSuccess ? (
          <p
            // Re-keyed so the pop replays on every save, not just the first.
            key={savedAt ?? 0}
            role="status"
            aria-live="polite"
            className="animate-save-pop inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-success)]/12 px-2.5 py-1 font-medium text-[color:var(--color-success)]"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M4.5 10.5l3.5 3.5 7.5-7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Saved
          </p>
        ) : (
          <span className="text-[color:var(--color-text-subtle)]">{hint}</span>
        )}
      </div>

      <Button type="submit" loading={saving} className="shrink-0">
        {saving ? "Saving…" : showSuccess ? "Saved ✓" : "Save changes"}
      </Button>
    </div>
  );
}
