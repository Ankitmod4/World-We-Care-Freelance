"use client";

import { HeaderNav } from "./header-nav";
import Link from "next/link";
import { LanguagePicker } from "./language-picker";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useCountry } from "./country-context";
import { AppearanceToggle } from "./appearance";
import { NavIcon } from "./nav-icons";
import type { ShellViewer } from "./site-shell";
import { Img } from "@/components/ui/img";
import { useT } from "./locale-context";
import { timeAgo } from "@/lib/time-ago";
import { TranslatedContent } from "./translated-content";

/**
 * Signed-in header. Replaces the marketing SiteHeader used on the
 * anonymous landing.
 *
 * Layout, left → right:
 *   • Hamburger (mobile only)
 *   • Logo → returns to /
 *   • Country picker — filters the feed and any country-scoped page
 *   • Profile menu — avatar dropdown with sign out + jump-to-profile
 */
export function SiteHeader({
  viewer,
  onOpenDrawer,
}: {
  viewer: ShellViewer;
  onOpenDrawer: () => void;
}) {
  const t = useT();
  return (
    <header className="chrome sticky top-0 z-30 frost-strong">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 h-16 flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label={t("header.openMenu", "Open menu")}
          className="lg:hidden min-h-11 min-w-11 flex items-center justify-center rounded-[10px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)]"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        <Link href="/" className="flex items-center gap-2 min-w-0">
          <Logo />
          <span className="hidden sm:inline font-semibold tracking-[-0.01em] truncate">WorldWeCare</span>
        </Link>

        <HeaderNav />

        <div className="flex-1" />

        {/* Below lg these live elsewhere: Messages and Alerts in the
            bottom tab bar, the country picker at the top of the menu
            sheet. Language is the exception — see below. */}
        <span className="hidden lg:contents">
          {/* Language sits beside country: the two questions are
              "where am I" and "how do I read", and they belong
              together. It renders nothing at all while English is the
              only live language. */}
          <LanguagePicker />
          <CountryPicker />
          <MessagesLink />
          <NotificationBell />
        </span>

        {/*
          LANGUAGE IS IN THE MOBILE HEADER TOO, and it is the only one
          of those four that is.

          The other three have somewhere obvious to be: Messages and
          Alerts are tabs along the bottom of every screen, and the
          country picker is the first row of the menu sheet, where
          somebody goes looking for it. Language had only the sheet —
          which means a reader who cannot read the interface has to
          open a menu labelled in a language they do not read to find
          the control that fixes that. It is the one setting whose
          whole purpose is being reachable before you can read
          anything else.

          It costs nothing when it is not needed: the picker renders
          null while English is the only live language, so this is an
          empty span on a single-language site.
        */}
        <span className="lg:hidden">
          <LanguagePicker />
        </span>

        <ProfileMenu viewer={viewer} />
      </div>
    </header>
  );
}

/* ── Country picker ──────────────────────────────────────────── */

function CountryPicker() {
  const t = useT();
  const { countries, country, countryId, setCountryId, ready } = useCountry();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [countries, query]);

  /**
   * Two shapes, not one.
   *
   * Unset is the default state, and a default should not be the widest
   * thing in the header — so it collapses to a single line-art globe,
   * the same weight and colour as the message and bell icons beside
   * it. No border, no fill: it was the only bordered control in a row
   * of borderless ones, which is what made it read as a form field
   * dropped into the chrome.
   *
   * Chosen is worth the space, so it takes it: flag, name, and the
   * brand tint that says a filter is on. The header only spends width
   * when it has something to say.
   */
  const chosen = !!country;
  const label = country?.name ?? t("header.allCountries", "All countries");

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          chosen
            ? t("header.countryChange", "Country: {name}. Change", { name: label })
            : t("header.chooseCountry", "Choose country")
        }
        aria-expanded={open}
        title={chosen ? label : t("header.allCountries", "All countries")}
        className={cn(
          "inline-flex items-center rounded-full transition-colors duration-200",
          chosen
            ? "min-h-9 gap-1.5 bg-[color:var(--color-brand)]/10 pl-2 pr-2.5 text-[13px] font-medium text-[color:var(--color-brand)] hover:bg-[color:var(--color-brand)]/15"
            : "min-h-11 min-w-11 justify-center text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-muted)] hover:text-[color:var(--color-text)]",
          open && !chosen && "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text)]",
        )}
      >
        {chosen ? (
          <>
            <span aria-hidden className="text-[14px] leading-none">
              {country?.emojiFlag ?? "🌍"}
            </span>
            <span className="hidden max-w-[9rem] truncate sm:inline">{label}</span>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden className="opacity-70">
              <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        ) : (
          <NavIcon name="globe" size={20} />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 rounded-[14px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)] overflow-hidden z-40">
          <div className="p-2.5 border-b border-[color:var(--color-border-soft)]">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("header.searchCountry", "Search country…")}
              className="w-full h-9 px-3 rounded-[10px] border border-[color:var(--color-border)] text-[13px] focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)]"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => {
                setCountryId(null);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left min-h-11 px-3 flex items-center gap-2 text-[13.5px] hover:bg-[color:var(--color-surface-hover)]",
                !countryId && "text-[color:var(--color-brand-ink)] font-semibold",
              )}
            >
              <span aria-hidden className="text-[color:var(--color-text-subtle)]">
                <NavIcon name="globe" size={16} />
              </span>
              <span>{t("header.allCountries", "All countries")}</span>
              {!countryId && <Tick />}
            </button>
            {!ready && (
              <p className="px-3 py-3 text-[12.5px] text-[color:var(--color-text-subtle)]">
                {t("common.loading", "Loading…")}
              </p>
            )}
            {ready && filtered.length === 0 && (
              <p className="px-3 py-3 text-[12.5px] text-[color:var(--color-text-subtle)]">
                {t("header.noMatches", "No matches.")}
              </p>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCountryId(c.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left min-h-11 px-3 flex items-center gap-2 text-[13.5px] hover:bg-[color:var(--color-surface-hover)]",
                  countryId === c.id && "text-[color:var(--color-brand-ink)] font-semibold",
                )}
              >
                <span aria-hidden className="text-[15px]">{c.emojiFlag ?? "🏳️"}</span>
                <span className="min-w-0 truncate">{c.name}</span>
                <span className="ml-auto text-[10.5px] font-mono text-[color:var(--color-text-subtle)]">
                  {c.code}
                </span>
                {countryId === c.id && <Tick />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Tick() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className="ml-1.5 shrink-0"
    >
      <path
        d="M4 10.5l4 4 8-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Profile menu ────────────────────────────────────────────── */

function ProfileMenu({ viewer }: { viewer: ShellViewer }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("header.profileMenu", "Profile menu")}
        className="min-h-11 min-w-11 flex items-center justify-center rounded-full hover:ring-2 hover:ring-[color:var(--color-brand-soft)] transition-shadow"
      >
        <Avatar name={viewer.displayName} url={viewer.avatarUrl} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-[14px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)] py-1 z-40">
          <div className="px-3 py-2.5 border-b border-[color:var(--color-border-soft)]">
            <p className="text-[13px] font-semibold tracking-[-0.01em] truncate">
              <TranslatedContent
                kind="member"
                id={viewer.id}
                field="displayName"
                text={viewer.displayName}
                toggle={false}
              />
            </p>
            <p className="text-[11.5px] text-[color:var(--color-text-subtle)] truncate">
              {viewer.email}
            </p>
          </div>
          <MenuLink href="/profile" onClick={() => setOpen(false)}>
            {t("menu.yourProfile", "Your profile")}
          </MenuLink>
          <MenuLink href="/saved" onClick={() => setOpen(false)}>
            {t("header.bookmarks", "Bookmarks")}
          </MenuLink>
          {/* The two money pages sit together, above Settings: one is
              what you've given, the other is what you're owed, and
              someone looking for either is looking for "my money". */}
          <MenuLink href="/settings/donations" onClick={() => setOpen(false)}>
            {t("menu.donations", "Donations")}
          </MenuLink>
          <MenuLink href="/settings/payouts" onClick={() => setOpen(false)}>
            {t("menu.gettingPaid", "Getting paid")}
          </MenuLink>
          <MenuLink href="/settings" onClick={() => setOpen(false)}>
            {t("menu.settings", "Settings")}
          </MenuLink>
          {/*
            Light / Auto / Dark lives here as well as in Settings
            because it is the one preference people change by time of
            day rather than once. Burying a nightly action three taps
            deep is how it stops being used.

            The menu deliberately does NOT close on a change: the
            point of the control is seeing the page turn, and closing
            over it hides the only feedback there is.
          */}
          <div className="px-3 pb-2 pt-2.5">
            <AppearanceToggle />
          </div>
          <div className="my-1 border-t border-[color:var(--color-border-soft)]" />
          <form action="/api/user/auth/logout" method="post">
            <button
              type="submit"
              className="w-full text-left min-h-11 px-3 text-[13.5px] text-[color:var(--color-danger)] hover:bg-[color:var(--color-surface-hover)]"
            >
              {t("menu.signOut", "Sign out")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block min-h-11 px-3 text-[13.5px] leading-[44px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)]"
    >
      {children}
    </Link>
  );
}

const NOTIF_ICON: Record<string, string> = {
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

interface HeaderNotif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

function MessagesLink() {
  const t = useT();
  const [count, setCount] = useState(0);
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/user/messages/unread");
      const d = (await res.json().catch(() => ({}))) as { inbox?: number; requests?: number };
      setCount((d.inbox ?? 0) + (d.requests ?? 0));
    } catch { /* noop */ }
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(() => { void load(); }, 25000);
    return () => clearInterval(t);
  }, [load]);
  return (
    <Link
      href="/messages"
      aria-label={t("tabs.messages", "Messages")}
      className="relative h-9 w-9 inline-flex items-center justify-center rounded-full text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-muted)] hover:text-[color:var(--color-text)] transition-colors"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 6.5A1.5 1.5 0 015.5 5h13A1.5 1.5 0 0120 6.5v9a1.5 1.5 0 01-1.5 1.5H9l-4 3.2V17H5.5A1.5 1.5 0 014 15.5v-9z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
      {count > 0 && (
        <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)] text-[10px] font-semibold inline-flex items-center justify-center">{count > 99 ? "99+" : count}</span>
      )}
    </Link>
  );
}

function NotificationBell() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HeaderNotif[]>([]);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/user/notifications?limit=8");
      const d = (await res.json().catch(() => null)) as { items: HeaderNotif[]; unread: number } | null;
      if (d) {
        setItems(d.items ?? []);
        setUnread(d.unread ?? 0);
      }
    } catch {
      /* offline — keep last state */
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 25000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
    const onDoc = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, load]);

  const openItem = (n: HeaderNotif) => {
    if (!n.isRead) {
      fetch("/api/user/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      }).catch(() => {});
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (n.actionUrl) router.push(n.actionUrl);
  };

  const markAll = async () => {
    await fetch("/api/user/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
            unread > 0
              ? t("notifications.withUnread", "Notifications ({n} unread)", { n: unread })
              : t("nav.notifications", "Notifications")
          }
        className="relative min-h-11 min-w-11 flex items-center justify-center rounded-[12px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)]"
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[color:var(--color-danger)] text-[color:var(--color-on-danger)] text-[9.5px] font-semibold tabular-nums flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-w-[calc(100vw-1.5rem)] rounded-[14px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)] overflow-hidden z-40">
          <div className="px-3 py-2.5 border-b border-[color:var(--color-border-soft)] flex items-center justify-between">
            <p className="text-[13px] font-semibold tracking-[-0.01em]">{t("notifications.title", "Notifications")}</p>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="text-[11.5px] font-medium text-[color:var(--color-brand)] hover:underline">
                {t("notifications.markAllRead", "Mark all read")}
              </button>
            )}
          </div>
          <div className="max-h-[22rem] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12.5px] text-[color:var(--color-text-subtle)]">{t("feed.caughtUp", "You're all caught up.")}</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openItem(n)}
                  className={cn(
                    "w-full text-left flex items-start gap-2.5 px-3 py-2.5 hover:bg-[color:var(--color-surface-hover)] transition-colors",
                    !n.isRead && "bg-[color:var(--color-brand-tint)]",
                  )}
                >
                  <span className="shrink-0 h-8 w-8 rounded-full bg-[color:var(--color-surface-muted)] flex items-center justify-center text-[14px]">
                    {NOTIF_ICON[n.type] ?? "🔔"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[12.5px] tracking-[-0.01em]", !n.isRead ? "font-semibold" : "font-medium")}><TranslatedContent kind="notification" id={n.id} field="title" text={n.title} toggle={false} /></p>
                    {n.body && (
                  <p className="text-[11.5px] text-[color:var(--color-text-muted)] truncate">
                    <TranslatedContent kind="notification" id={n.id} field="body" text={n.body} toggle={false} />
                  </p>
                )}
                    <p className="text-[10.5px] text-[color:var(--color-text-subtle)] mt-0.5">{timeAgo(t, n.createdAt)}</p>
                  </div>
                  {!n.isRead && <span className="shrink-0 mt-1.5 h-2 w-2 rounded-full bg-[color:var(--color-brand)]" />}
                </button>
              ))
            )}
          </div>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block text-center py-2.5 text-[12.5px] font-medium text-[color:var(--color-brand)] border-t border-[color:var(--color-border-soft)] hover:bg-[color:var(--color-surface-hover)]"
          >
            {t("notifications.seeAll", "See all notifications")}
          </Link>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M5 8a5 5 0 0110 0v4l1.5 2.5H3.5L5 12V8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 16a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}


function Avatar({ name, url }: { name: string; url: string | null }) {
  const initials = useMemo(
    () =>
      name
        .split(/\s+/)
        .map((s) => s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    [name],
  );
  if (url) {
    return (
      <Img
        src={url}
        alt=""
        className="h-9 w-9 rounded-full object-cover bg-[color:var(--color-surface-muted)]"
        variant="thumb"
      />
    );
  }
  return (
    <div className="h-9 w-9 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] flex items-center justify-center text-[12px] font-semibold">
      {initials || "?"}
    </div>
  );
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="var(--color-brand)" />
      <path
        d="M10 20c1.2-2.8 3.4-4.5 6-4.5s4.8 1.7 6 4.5M13 12.5a3 3 0 116 0"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
