"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteShell, type ShellViewer } from "./site-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "./locale-context";
import { timeAgo } from "@/lib/time-ago";
import { TranslatedContent } from "./translated-content";

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

const ICON: Record<string, string> = {
  CHAT_REPLY: "💬",
  CHAT_MENTION: "@",
  CHAT_REACTION: "❤️",
  CRISIS_ALERT: "🚨",
  POST_LIKE: "❤️",
  POST_COMMENT: "💬",
  FOLLOW: "👤",
  DIRECT_MESSAGE: "✉️",
  SYSTEM: "🔔",
};

export function NotificationsClient({ viewer }: { viewer: ShellViewer }) {
  const t = useT();
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/user/notifications?limit=25");
    const d = (await res.json().catch(() => null)) as { items: Notif[]; nextCursor: string | null } | null;
    if (d) {
      setItems(d.items);
      setCursor(d.nextCursor);
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const res = await fetch(`/api/user/notifications?limit=25&cursor=${encodeURIComponent(cursor)}`);
    const d = (await res.json().catch(() => null)) as { items: Notif[]; nextCursor: string | null } | null;
    if (d) {
      setItems((prev) => [...prev, ...d.items]);
      setCursor(d.nextCursor);
    }
    setLoadingMore(false);
  };

  const markAll = async () => {
    await fetch("/api/user/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const open = async (n: Notif) => {
    if (!n.isRead) {
      fetch("/api/user/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      }).catch(() => {});
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    }
    if (n.actionUrl) router.push(n.actionUrl);
  };

  return (
    <SiteShell viewer={viewer}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("notifications.title", "Notifications")}</h1>
          <p className="text-[13px] text-[color:var(--color-text-muted)] mt-0.5">{t("notifications.blurb", "Replies, mentions, reactions and alerts.")}</p>
        </div>
        {items.some((n) => !n.isRead) && (
          <Button variant="secondary" size="sm" onClick={markAll}>{t("notifications.markAllRead", "Mark all read")}</Button>
        )}
      </header>

      {loading ? (
        <p className="text-[13px] text-[color:var(--color-text-subtle)]">{t("common.loading", "Loading…")}</p>
      ) : items.length === 0 ? (
        <div className="rounded-[16px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-8 text-center">
          <p className="text-[15px] font-semibold tracking-[-0.01em]">{t("notifications.caughtUp", "You're all caught up")}</p>
          <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">{t("notifications.emptyBlurb", "Replies and mentions will show up here.")}</p>
        </div>
      ) : (
        <div className="rounded-[16px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] divide-y divide-[color:var(--color-border-soft)] overflow-hidden">
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => open(n)}
              className={cn(
                "w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-[color:var(--color-surface-hover)] transition-colors",
                !n.isRead && "bg-[color:var(--color-brand-tint)]",
              )}
            >
              <span className="shrink-0 h-9 w-9 rounded-full bg-[color:var(--color-surface-muted)] flex items-center justify-center text-[16px]">
                {ICON[n.type] ?? "🔔"}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-[13.5px] tracking-[-0.01em]", !n.isRead ? "font-semibold" : "font-medium")}><TranslatedContent kind="notification" id={n.id} field="title" text={n.title} toggle={false} /></p>
                {n.body && (
          <p className="text-[12.5px] text-[color:var(--color-text-muted)] truncate">
            <TranslatedContent kind="notification" id={n.id} field="body" text={n.body} toggle={false} />
          </p>
        )}
                <p className="text-[11px] text-[color:var(--color-text-subtle)] mt-0.5">{timeAgo(t, n.createdAt)}</p>
              </div>
              {!n.isRead && <span className="shrink-0 mt-1.5 h-2 w-2 rounded-full bg-[color:var(--color-brand)]" />}
            </button>
          ))}
        </div>
      )}

      {cursor && (
        <div className="flex justify-center pt-3">
          <button type="button" onClick={loadMore} disabled={loadingMore} className="min-h-11 px-5 rounded-[12px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] text-[13.5px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] disabled:opacity-50">
            {loadingMore ? t("common.loading", "Loading\u2026") : t("common.loadMore", "Load more")}
          </button>
        </div>
      )}
    </SiteShell>
  );
}

