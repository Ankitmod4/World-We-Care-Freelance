"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FeedPost } from "./post-card";
import { reportReasons } from "@/lib/report-reasons";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";

const NOTES_MAX = 2000;

/**
 * Report a post. Bottom sheet on mobile, centered dialog on ≥ sm.
 * Reason is required; notes are optional but capped.
 *
 * Server dedupes silently — if the user's already flagged this
 * post, the response comes back as { duplicate: true } and the
 * parent shows a friendlier toast instead of an error.
 */
export function ReportModal({
  post,
  onClose,
  onDone,
  onError,
}: {
  post: FeedPost;
  onClose: () => void;
  onDone: (duplicate: boolean) => void;
  onError: (msg: string) => void;
}) {
  const t = useT();
  const REASONS = reportReasons(t);
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Escape to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const submit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/user/posts/${post.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          notes: notes.trim() || undefined,
        }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        duplicate?: boolean;
        error?: string;
      };
      if (!res.ok || !d.ok) {
        onError(serverText(t, d?.error) || "Couldn't file the report.");
        return;
      }
      onDone(!!d.duplicate);
    } catch {
      onError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={submitting ? undefined : onClose}
      />
      <div className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-[color:var(--color-surface)] rounded-t-2xl sm:rounded-2xl border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[color:var(--color-border-soft)] flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold tracking-[-0.01em]">
              {t("report.title", "Report this post")}
            </h2>
            <p className="text-[12px] text-[color:var(--color-text-muted)] mt-0.5">
              {t("report.subtitle", "A moderator will review it. Thanks for keeping the wall kind.")}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            aria-label={t("common.close", "Close")}
            className="min-h-11 min-w-11 flex items-center justify-center rounded-[10px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)] disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M4 4l8 8M12 4L4 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Post preview */}
        <div className="px-5 pt-4">
          <div className="rounded-[12px] bg-[color:var(--color-surface-muted)] border border-[color:var(--color-border-soft)] p-3">
            <p className="text-[11.5px] font-medium text-[color:var(--color-text-subtle)]">
              {post.isAnonymous ? t("post.anonymous", "Anonymous member") : post.authorName}
            </p>
            <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)] line-clamp-3 break-words">
              {post.body}
            </p>
          </div>
        </div>

        {/* Reasons */}
        <div className="px-5 pt-4">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)] mb-2">
            {t("report.why", "Why?")}
          </p>
          <div className="space-y-1.5">
            {REASONS.map((r) => (
              <label
                key={r.value}
                className={cn(
                  "flex items-start gap-3 rounded-[12px] border px-3.5 py-2.5 cursor-pointer transition-colors",
                  reason === r.value
                    ? "bg-[color:var(--color-brand-tint)] border-[color:var(--color-brand)]"
                    : "bg-[color:var(--color-surface)] border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]",
                )}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="mt-1 accent-[color:var(--color-brand)]"
                />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium">{r.label}</p>
                  <p className="text-[11.5px] text-[color:var(--color-text-muted)] mt-0.5">
                    {r.hint}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="px-5 pt-4">
          <label className="block text-[12.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)] mb-1.5">
            {t("report.addContext", "Add context (optional)")}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={NOTES_MAX + 200}
            placeholder={t("report.notesPlaceholder", "Anything the moderator should know?")}
            className="block w-full rounded-[12px] border border-[color:var(--color-border)] px-3 py-2.5 text-[13.5px] leading-relaxed placeholder:text-[color:var(--color-text-subtle)] focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)] resize-none"
          />
          <p className="mt-1 text-[11px] text-[color:var(--color-text-subtle)] text-right tabular-nums">
            {notes.length}/{NOTES_MAX}
          </p>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-[color:var(--color-border-soft)] mt-2 flex gap-2 sticky bottom-0 frost-strong">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={submitting}
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={submitting}
            disabled={!reason || notes.length > NOTES_MAX}
            onClick={submit}
          >
            {submitting ? t("report.sending", "Reporting…") : t("report.send", "Report")}
          </Button>
        </div>
      </div>
    </div>
  );
}
