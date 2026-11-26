"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Notif {
  id: string;
  type: string;
  title: string;
  message: string | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

interface BellPayload {
  unread: number;
  items: Notif[];
}

/**
 * Real-time notifications bell in the topbar.
 *
 * Subscribes to `/api/admin/notifications/stream` (SSE) on mount so
 * the badge updates within ~5s of any change without the admin
 * needing to refresh. Falls back to fetching the payload once on
 * dropdown open in case the stream reconnected slowly.
 *
 * Click a row → navigates to actionUrl AND marks that row read.
 * "Mark all read" flips every unread row.
 */
export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<BellPayload>({ unread: 0, items: [] });
  const [ping, setPing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // ── Real-time stream ────────────────────────────────────────
  useEffect(() => {
    const es = new EventSource("/api/admin/notifications/stream");
    es.addEventListener("bell", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as BellPayload;
        setPayload((prev) => {
          const grew = data.unread > prev.unread;
          if (grew) {
            // Ping the bell — subtle attention grab when a new
            // notification lands while the tab is focused.
            setPing(true);
            window.setTimeout(() => setPing(false), 1600);
          }
          return data;
        });
      } catch {
        // ignore malformed events
      }
    });
    es.onerror = () => {
      // Browser will auto-retry — nothing to do here. If we wanted
      // reconnect feedback we'd surface it here.
    };
    return () => es.close();
  }, []);

  // ── Manual refresh on open — belt + braces ─────────────────
  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: BellPayload | null) => {
        if (d) setPayload(d);
      })
      .catch(() => {});
  }, [open]);

  // ── Close on outside click / escape ────────────────────────
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markAllRead = async () => {
    const res = await fetch("/api/admin/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (res.ok) {
      setPayload((p) => ({
        unread: 0,
        items: p.items.map((n) =>
          n.readAt ? n : { ...n, readAt: new Date().toISOString() },
        ),
      }));
    }
  };

  const openItem = async (n: Notif) => {
    // Mark read optimistically so the UI reacts instantly.
    if (!n.readAt) {
      setPayload((p) => ({
        unread: Math.max(0, p.unread - 1),
        items: p.items.map((it) =>
          it.id === n.id ? { ...it, readAt: new Date().toISOString() } : it,
        ),
      }));
      fetch("/api/admin/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      }).catch(() => {});
    }
    setOpen(false);
    if (n.actionUrl) {
      router.push(n.actionUrl);
    }
  };

  const unread = payload.unread;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread > 0 ? ` — ${unread} unread` : ""}`}
        aria-expanded={open}
        className={cn(
          "relative min-h-11 min-w-11 flex items-center justify-center rounded-[10px]",
          "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)]",
          "transition-colors",
          ping && "text-[color:var(--color-brand)]",
        )}
      >
        <BellIcon shake={ping} />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[color:var(--color-danger)] text-[color:var(--color-on-danger)] text-[10px] font-semibold flex items-center justify-center tabular-nums shadow-[0_0_0_2px_var(--color-surface)]">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-[min(88vw,360px)] rounded-[16px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)] z-40 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--color-border-soft)]">
            <div>
              <p className="text-[14px] font-semibold">Notifications</p>
              <p className="text-[11.5px] text-[color:var(--color-text-subtle)]">
                {unread > 0
                  ? `${unread} unread`
                  : "You're all caught up"}
              </p>
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[12px] font-medium text-[color:var(--color-brand)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {payload.items.length === 0 ? (
              <div className="py-10 px-6 text-center">
                <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand)] flex items-center justify-center">
                  <BellIcon />
                </div>
                <p className="text-[13.5px] font-medium">Nothing to see yet</p>
                <p className="text-[12px] text-[color:var(--color-text-subtle)] mt-0.5">
                  New signups + activity will land here.
                </p>
              </div>
            ) : (
              <ul>
                {payload.items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={cn(
                        "w-full text-left px-4 py-3 flex items-start gap-3 transition-colors",
                        "hover:bg-[color:var(--color-surface-hover)]",
                        !n.readAt && "bg-[color:var(--color-brand-tint)]",
                      )}
                    >
                      <TypeIcon type={n.type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "text-[13.5px]",
                              !n.readAt ? "font-semibold" : "font-medium",
                            )}
                          >
                            {n.title}
                          </p>
                          <span className="shrink-0 text-[11px] text-[color:var(--color-text-subtle)] tabular-nums whitespace-nowrap">
                            {relativeTime(n.createdAt)}
                          </span>
                        </div>
                        {n.message && (
                          <p className="text-[12.5px] text-[color:var(--color-text-muted)] mt-0.5 truncate">
                            {n.message}
                          </p>
                        )}
                      </div>
                      {!n.readAt && (
                        <span
                          aria-hidden
                          className="mt-1.5 shrink-0 h-2 w-2 rounded-full bg-[color:var(--color-brand)]"
                        />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon({ shake }: { shake?: boolean }) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={cn(shake && "animate-[shake_0.6s_ease-in-out]")}
    >
      <path
        d="M10 3a4.5 4.5 0 00-4.5 4.5v2.2c0 .5-.2 1-.5 1.4L4 12.7c-.4.6 0 1.4.7 1.4h10.6c.7 0 1.1-.8.7-1.4l-1-1.6c-.3-.4-.5-.9-.5-1.4V7.5A4.5 4.5 0 0010 3zM8 15.5a2 2 0 004 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TypeIcon({ type }: { type: string }) {
  // Sky-blue tinted chip per type — quick visual differentiation
  // without another color axis to juggle.
  const map: Record<string, { bg: string; fg: string; icon: React.ReactNode }> = {
    USER_SIGNED_UP: {
      bg: "bg-[color:var(--color-brand-soft)]",
      fg: "text-[color:var(--color-brand)]",
      icon: <UserPlusIcon />,
    },
    USER_EMAIL_VERIFIED: {
      bg: "bg-[color:var(--color-success-soft)]",
      fg: "text-[color:var(--color-success)]",
      icon: <CheckIcon />,
    },
    USER_BANNED: {
      bg: "bg-[color:var(--color-danger-soft)]",
      fg: "text-[color:var(--color-danger)]",
      icon: <BanIcon />,
    },
    USER_DELETED: {
      bg: "bg-[color:var(--color-surface-hover)]",
      fg: "text-[color:var(--color-text-subtle)]",
      icon: <TrashIcon />,
    },
  };
  const conf = map[type] ?? {
    bg: "bg-[color:var(--color-surface-hover)]",
    fg: "text-[color:var(--color-text-subtle)]",
    icon: <BellIcon />,
  };
  return (
    <span
      className={cn(
        "shrink-0 h-9 w-9 rounded-full flex items-center justify-center",
        conf.bg,
        conf.fg,
      )}
    >
      {conf.icon}
    </span>
  );
}

function UserPlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 17c0-3 2.7-5 6-5 1.3 0 2.5.3 3.5.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M15 11v6M12 14h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 5l10 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M4 6h12M7 6V4a1 1 0 011-1h4a1 1 0 011 1v2M6 6l1 10a1 1 0 001 1h4a1 1 0 001-1l1-10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return `${Math.floor(days / 30)}mo`;
}
