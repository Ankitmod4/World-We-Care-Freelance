"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Small confirmation dialog — centered card on desktop, bottom sheet
 * on mobile. Sits at z-[70] so it renders above the post lightbox
 * (z-[60]) and any toasts. Escape or a backdrop click cancels.
 *
 * Render it conditionally (or pass `open`); it returns null when
 * closed so parents can mount it unconditionally too.
 */
export function ConfirmDialog({
  open = true,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open?: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={loading ? undefined : onCancel}
      />
      <div className="relative w-full sm:max-w-sm bg-[color:var(--color-surface)] rounded-t-2xl sm:rounded-2xl border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)] p-5">
        <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
        {message && (
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[color:var(--color-text-muted)]">
            {message}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            className="flex-1"
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
