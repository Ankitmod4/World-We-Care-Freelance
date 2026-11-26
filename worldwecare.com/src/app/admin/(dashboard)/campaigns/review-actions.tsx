"use client";

/**
 * Approve / reject, on the campaigns list.
 *
 * IN THE LIST RATHER THAN ON A DETAIL PAGE, because the queue is read
 * in a run: a reviewer goes down the pending ones and makes a call on
 * each. Making them open and come back for every decision is what
 * turns a ten-item queue into a job nobody starts.
 *
 * The CATEGORY PICKER sits next to the buttons for the same reason.
 * A submission arrives with the member's guess, and approving is the
 * last moment it can be corrected before readers start browsing by it
 * — so the fix happens here rather than being a second trip through
 * the edit form. It is also why the server refuses an approval with no
 * category at all: it would go live under no tile.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CampaignReviewActions({
  id,
  categoryId,
  categories,
}: {
  id: string;
  categoryId: string | null;
  categories: Array<{ id: string; name: string; emoji: string | null }>;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState(categoryId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (action: "approve" | "reject") => {
    let reason: string | undefined;
    if (action === "reject") {
      const typed = window.prompt(
        "Why is this being rejected? The person who submitted it will see this.",
      );
      // Cancel means cancel. An empty string would send a rejection
      // with no reason, which is the one thing worse than no reply.
      if (typed === null) return;
      reason = typed;
    }

    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/campaigns/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason, categoryId: choice || null }),
    }).catch(() => null);
    setBusy(false);

    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      // The server's refusals are sentences worth reading — "choose a
      // category before publishing, otherwise it won't appear under
      // any tile" — so they are shown rather than replaced.
      setError(d?.error ?? "That didn't work.");
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          aria-label="Category"
          className="h-8 max-w-[190px] rounded-lg border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] px-2 text-[12.5px] outline-none"
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji ? `${c.emoji} ` : ""}
              {c.name}
            </option>
          ))}
        </select>
        <Button size="sm" disabled={busy} onClick={() => void act("approve")}>
          Approve
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act("reject")}>
          Reject
        </Button>
      </div>
      {error && (
        <p className="max-w-[320px] text-right text-[11.5px] text-[color:var(--color-danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
