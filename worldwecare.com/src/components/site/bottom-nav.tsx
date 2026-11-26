"use client";

/**
 * Mobile tab bar.
 *
 * Five destinations, no more — a sixth turns a thumb-sized target into
 * a lottery. Everything else in the sidebar stays reachable through the
 * header's menu button, which is why "More" isn't a tab here.
 *
 * Two things this file is careful about:
 *
 *  1. Height lives in `--bottom-nav-h` (globals.css), not in this
 *     component. The page padding, the full-height chat panes and the
 *     toasts all subtract the same number; hard-coding it here would
 *     mean four places to change and three of them forgotten.
 *  2. The badges poll the same two endpoints the header already uses.
 *     On mobile the header's copies are hidden, so this is not a second
 *     poll of the same data — it replaces them.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NavIcon } from "./nav-icons";
import { useT } from "./locale-context";
import type { ShellViewer } from "./site-shell";
import { Img } from "@/components/ui/img";

export function BottomNav({ viewer }: { viewer: ShellViewer }) {
  const t = useT();
  const pathname = usePathname();
  const [messages, setMessages] = useState(0);
  const [notifs, setNotifs] = useState(0);

  const load = useCallback(async () => {
    const [m, n] = await Promise.all([
      fetch("/api/user/messages/unread")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/api/user/notifications?limit=1")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);
    if (m) setMessages((m.inbox ?? 0) + (m.requests ?? 0));
    if (n) setNotifs(n.unread ?? 0);
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  // Re-check on arrival at either tab, so the badge clears as soon as
  // the page that reads them has been opened.
  useEffect(() => {
    if (pathname === "/messages" || pathname === "/notifications") {
      const timer = setTimeout(() => void load(), 1200);
      return () => clearTimeout(timer);
    }
  }, [pathname, load]);

  const tabs = [
    { href: "/", label: t("tabs.home", "Home"), icon: <NavIcon name="home" size={21} /> },
    { href: "/chatrooms", label: t("tabs.rooms", "Rooms"), icon: <NavIcon name="chat" size={21} /> },
    {
      href: "/messages",
      label: t("tabs.messages", "Messages"),
      icon: <NavIcon name="mail" size={21} />,
      badge: messages,
    },
    {
      href: "/notifications",
      label: t("tabs.alerts", "Alerts"),
      icon: <NavIcon name="bell" size={21} />,
      badge: notifs,
    },
    {
      href: "/profile",
      label: t("tabs.profile", "Profile"),
      icon: <Avatar viewer={viewer} />,
    },
  ];

  return (
    <nav
      aria-label={t("tabs.ariaLabel", "Primary")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--color-border-soft)] frost-strong lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="flex h-14 items-stretch">
        {tabs.map((tab) => {
          const active = isActive(tab.href, pathname);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors duration-200 ${
                  active
                    ? "text-[color:var(--color-brand)]"
                    : "text-[color:var(--color-text-subtle)]"
                }`}
              >
                <span className="relative flex h-6 w-6 items-center justify-center">
                  {tab.icon}
                  {typeof tab.badge === "number" && tab.badge > 0 && (
                    <span className="absolute -right-2 -top-1 min-w-[16px] rounded-full bg-[color:var(--color-danger)] px-1 text-[9.5px] font-semibold leading-[16px] text-[color:var(--color-on-danger)]">
                      {tab.badge > 9 ? "9+" : tab.badge}
                    </span>
                  )}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function Avatar({ viewer }: { viewer: ShellViewer }) {
  if (viewer.avatarUrl) {
    return (
      <Img
        src={viewer.avatarUrl}
        alt=""
        className="h-6 w-6 rounded-full object-cover ring-1 ring-[color:var(--color-border-soft)]"
        variant="thumb"
      />
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--color-surface-muted)] text-[10px] font-semibold text-[color:var(--color-text-muted)]">
      {viewer.displayName.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
