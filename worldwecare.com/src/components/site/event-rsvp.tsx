"use client";

/**
 * RSVP control for an event page.
 *
 * Optimistic, then reconciled against the server's count — and it
 * surfaces the two states a plain toggle would hide: the event being
 * full, and the event having been cancelled.
 *
 * The controls fill the width below `sm` and sit in a row above it.
 * That used to be a `stacked` prop, set by the detail page because
 * its sidebar card was narrow. The sidebar is gone and the answer is
 * the same everywhere now: a thumb wants a full-width button, a
 * mouse does not need one.
 */

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";

export function EventRsvp({
  eventId,
  initialGoing,
  initialCount,
  disabled,
  full,
  joinUrl,
  roomSlug,
  showCount = true,
}: {
  eventId: string;
  initialGoing: boolean;
  initialCount: number;
  disabled: boolean;
  full: boolean;
  joinUrl: string | null;
  roomSlug: string | null;
  showCount?: boolean;
}) {
  const t = useT();
  const [going, setGoing] = useState(initialGoing);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/user/events/${eventId}/rsvp`, { method: "POST" });
    const d = (await res.json().catch(() => ({}))) as {
      going?: boolean;
      rsvpCount?: number;
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setError(serverText(t, d?.error) || t("rsvp.failed", "Could not update your RSVP"));
      return;
    }
    if (typeof d.going === "boolean") setGoing(d.going);
    if (typeof d.rsvpCount === "number") setCount(d.rsvpCount);
  };

  // Deliberately the same metrics as <Button size="md" variant="secondary">:
  // 40px tall, 12px radius. These are anchors, not buttons, so they
  // cannot BE that component — but sitting next to it in a row, a
  // pill of a different height reads as a mistake. The old sidebar
  // stacked them full-width, which hid the mismatch.
  const secondary =
    "inline-flex h-10 w-full items-center justify-center rounded-[12px] border " +
    "border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 text-sm " +
    "font-medium transition-colors duration-150 hover:bg-[color:var(--color-surface-hover)] " +
    "hover:border-[color:var(--color-brand)] sm:w-auto";

  return (
    <div className="w-full sm:w-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          onClick={toggle}
          loading={busy}
          disabled={disabled || (full && !going)}
          variant={going ? "secondary" : "primary"}
          className="w-full sm:w-auto"
        >
          {going
            ? t("rsvp.going", "You're going ✓")
            : full
              ? t("rsvp.full", "Event full")
              : t("rsvp.join", "Count me in")}
        </Button>

        {going && joinUrl && (
          <a href={joinUrl} target="_blank" rel="noopener noreferrer" className={secondary}>
            {t("eventNew.joinLink", "Join link")}
          </a>
        )}

        {roomSlug && (
          <Link href={`/chatrooms/${roomSlug}`} className={secondary}>
            {t("rsvp.chatroom", "Event chatroom")}
          </Link>
        )}

        {showCount && (
          <span className="text-[13px] tabular-nums text-[color:var(--color-text-muted)]">
            {count} going
          </span>
        )}
      </div>
      {error && (
        <p className="mt-2 text-[12.5px] text-[color:var(--color-danger)]">{error}</p>
      )}
    </div>
  );
}
