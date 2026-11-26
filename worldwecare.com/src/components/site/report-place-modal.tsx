"use client";

/**
 * "Something's wrong with this listing."
 *
 * Six reasons and a box. Anything longer and the person who walked to a
 * locked door — which is the only person who ever fills this in — closes
 * the tab instead. The reasons are the ways a directory entry actually
 * goes stale, not moderation categories; nobody reports a food bank for
 * hate speech.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { placeReportKinds, type PlaceReportKindValue } from "@/lib/place-report-kinds";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";

export function ReportPlaceModal({
  open,
  placeId,
  placeName,
  onClose,
}: {
  open: boolean;
  placeId: string;
  placeName: string;
  onClose: () => void;
}) {
  const t = useT();
  const KINDS = placeReportKinds(t);
  const [kind, setKind] = useState<PlaceReportKindValue | null>(null);
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind(null);
    setNotes("");
    setError(null);
    setDone(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const send = async () => {
    if (!kind) {
      setError(t("placeReport.pickOne", "Pick what's wrong."));
      return;
    }
    setSending(true);
    setError(null);
    const res = await fetch(`/api/user/places/${placeId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, notes: notes.trim() || null }),
    }).catch(() => null);
    setSending(false);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(serverText(t, d?.error) || t("placeReport.failed", "That didn't send. Try again in a moment."));
      return;
    }
    setDone(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Report ${placeName}`}
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-[color:var(--color-surface)] shadow-elevated sm:max-h-[88vh] sm:rounded-2xl"
      >
        {done ? (
          <div className="px-5 py-10 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-brand)]/10 text-[color:var(--color-brand)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="text-[16px] font-semibold">{t("placeReport.thanks", "Thanks — we'll check it")}</p>
            <p className="mx-auto mt-1.5 max-w-[38ch] text-[13.5px] text-[color:var(--color-text-muted)]">
              {t(
                "placeReport.thanksBlurb",
                "Someone will look at this listing. If it has closed or moved, we'd rather know than send the next person to the same door.",
              )}
            </p>
            <Button size="sm" className="mt-4" onClick={onClose}>{t("common.close", "Close")}</Button>
          </div>
        ) : (
          <>
            <header className="flex items-start justify-between gap-3 border-b border-[color:var(--color-border-soft)] px-4 py-3.5">
              <div className="min-w-0">
                <h2 className="text-[17px] font-semibold tracking-[-0.01em]">
                  {t("placeReport.title", "Report a problem")}
                </h2>
                <p className="mt-0.5 truncate text-[12.5px] text-[color:var(--color-text-muted)]">
                  {placeName}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.close", "Close")}
                className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-muted)]"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <fieldset className="space-y-1.5">
                <legend className="mb-1.5 text-[13px] font-semibold">
                  {t("placeReport.whatsWrong", "What's wrong?")}
                </legend>
                {KINDS.map((k) => (
                  <label
                    key={k.value}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13.5px] transition-colors duration-200 ${
                      kind === k.value
                        ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)]/8"
                        : "border-[color:var(--color-border-soft)] hover:border-[color:var(--color-border)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="place-report-kind"
                      value={k.value}
                      checked={kind === k.value}
                      onChange={() => setKind(k.value)}
                      className="accent-[color:var(--color-brand)]"
                    />
                    {k.label}
                  </label>
                ))}
              </fieldset>

              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
                  {t("placeReport.anythingElse", "Anything else? (optional)")}
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder={t(
                    "placeReport.notesPlaceholder",
                    "New address, new hours, what happened when you went…",
                  )}
                  className="w-full rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-[14px] outline-none focus:border-[color:var(--color-brand)]"
                />
              </label>

              {error && (
                <p className="rounded-xl bg-[color:var(--color-danger)]/10 px-3 py-2 text-[13px] text-[color:var(--color-danger)]">
                  {error}
                </p>
              )}
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-[color:var(--color-border-soft)] px-4 py-3">
              <Button size="sm" variant="ghost" onClick={onClose}>{t("common.cancel", "Cancel")}</Button>
              <Button size="sm" onClick={() => void send()} loading={sending} disabled={sending}>
                {t("placeReport.send", "Send report")}
              </Button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
