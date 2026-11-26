"use client";

/**
 * The header navigation — five pills, four of which open a panel.
 *
 * WHY IT MOVED. Every destination used to live in a sixteen-item list
 * down the left rail, which meant the rail could never be anything
 * else, and sixteen flat items is a list you read rather than a menu
 * you use. Grouping them puts the whole site two hovers away and frees
 * the rail for the member's own things.
 *
 * NOT HOVER-ONLY, unlike the menu this is modelled on. Hover opens it
 * on a mouse, but the trigger is a real button that opens on click and
 * on keyboard focus, Escape closes it, and arrow-free tabbing walks
 * the items — because a hover-only menu is unreachable by keyboard and
 * unusable on a tablet, where there is no hover at all and the first
 * tap would otherwise just navigate away to the parent page.
 *
 * The parent pill is still a link. Clicking "Community" goes to
 * Chatrooms; the panel is a shortcut past it, not a gate in front.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon, type NavIconName } from "./nav-icons";
import { useT } from "./locale-context";
import type { TFunction } from "@/lib/i18n-core";

interface NavChild {
  href: string;
  /** Looks the text up in NAV_TEXT. The English lives there, literally. */
  key: string;
  icon: NavIconName;
}

interface NavGroup {
  key: string;
  /** Where the pill itself goes. The most-used child. */
  href: string;
  icon: NavIconName;
  children: NavChild[];
}

/**
 * The navigation's words, declared as literal `t()` calls.
 *
 * WHY THEY ARE NOT IN THE TABLE BELOW. `scripts/extract-strings.ts`
 * reads the source for `t("key", "English")` and can only see a call
 * whose key it can read; `t(child.key, child.label)` is invisible to
 * it, so a nav whose labels lived in the data table would be a nav
 * that never appears in the catalogue and therefore never gets
 * translated — silently, which is the worst way for it to happen.
 *
 * So the table carries the STRUCTURE (where each item goes, what icon
 * it has) and this carries the TEXT. Each string is still written
 * exactly once.
 */
function navText(t: TFunction): Record<string, string> {
  return {
    "nav.community": t("nav.community", "Community"),
    "nav.chatrooms": t("nav.chatrooms", "Chatrooms"),
    "nav.chatrooms.blurb": t("nav.chatrooms.blurb", "Talk to people who understand"),
    "nav.gratitude": t("nav.gratitude", "Gratitude wall"),
    "nav.gratitude.blurb": t("nav.gratitude.blurb", "What people are thankful for"),
    "nav.townHeroes": t("nav.townHeroes", "Town Heroes"),
    "nav.townHeroes.blurb": t("nav.townHeroes.blurb", "People who quietly help"),
    "nav.members": t("nav.members", "Members"),
    "nav.members.blurb": t("nav.members.blurb", "Find people to follow"),

    "nav.read": t("nav.read", "Read & watch"),
    "nav.articles": t("nav.articles", "Articles"),
    "nav.articles.blurb": t("nav.articles.blurb", "Stories and guidance"),
    "nav.library": t("nav.library", "Library"),
    "nav.library.blurb": t("nav.library.blurb", "Short, uplifting clips"),
    "nav.live": t("nav.live", "Live"),
    "nav.live.blurb": t("nav.live.blurb", "On right now"),

    "nav.near": t("nav.near", "Near you"),
    "nav.places": t("nav.places", "Places"),
    "nav.places.blurb": t("nav.places.blurb", "Programs, clinics, food banks"),
    "nav.events": t("nav.events", "Events"),
    "nav.events.blurb": t("nav.events.blurb", "Real gatherings nearby"),

    "nav.action": t("nav.action", "Take action"),
    "nav.campaigns": t("nav.campaigns", "Campaigns"),
    "nav.campaigns.blurb": t("nav.campaigns.blurb", "Causes to get behind"),
    "nav.petitions": t("nav.petitions", "Petitions"),
    "nav.petitions.blurb": t("nav.petitions.blurb", "Ask for something to change"),
  };
}

/**
 * The groups.
 *
 * Ordered the way the plan describes someone arriving: read quietly,
 * then talk, then find something real nearby, then do something about
 * it. Every destination from the old sidebar list is here — nothing
 * was dropped in the move, and the personal ones (journal, progress,
 * saved, messages) are in the rail instead, where they belong.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: "nav.community",
    href: "/chatrooms",
    icon: "chat",
    children: [
      { href: "/chatrooms", key: "nav.chatrooms", icon: "chat" },
      { href: "/gratitude", key: "nav.gratitude", icon: "heart" },
      { href: "/town-heroes", key: "nav.townHeroes", icon: "star" },
      { href: "/members", key: "nav.members", icon: "user" },
    ],
  },
  {
    key: "nav.read",
    href: "/articles",
    icon: "article",
    children: [
      { href: "/articles", key: "nav.articles", icon: "article" },
      { href: "/library", key: "nav.library", icon: "clip" },
      { href: "/live", key: "nav.live", icon: "live" },
    ],
  },
  {
    key: "nav.near",
    href: "/places",
    icon: "pin",
    children: [
      { href: "/places", key: "nav.places", icon: "pin" },
      { href: "/events", key: "nav.events", icon: "calendar" },
    ],
  },
  {
    key: "nav.action",
    href: "/campaigns",
    icon: "megaphone",
    children: [
      { href: "/campaigns", key: "nav.campaigns", icon: "megaphone" },
      { href: "/petitions", key: "nav.petitions", icon: "petition" },
    ],
  },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function HeaderNav() {
  const t = useT();
  const text = navText(t);
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const wrapRef = useRef<HTMLElement | null>(null);
  /** Hover-out is delayed so the diagonal to the panel is forgiving. */
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Whether the panel was ALREADY open when the press started.
   *
   * A plain `toggle on click` looks right and is broken on a
   * touchscreen: the tap synthesises a mouseenter first, which opens
   * the panel, so by the time the click runs it sees "open" and closes
   * it again — the menu can never be opened by tapping. `pointerdown`
   * lands before that synthesised hover, so this records the state the
   * member actually saw when they pressed.
   */
  const wasOpen = useRef(false);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(null), 120);
  }, [cancelClose]);

  // Escape closes, and a click anywhere else closes. Both are what a
  // keyboard user and a tablet user respectively expect, and neither
  // comes free with a hover menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  // Navigating closes it. Without this the panel stays open over the
  // page you just asked for.
  useEffect(() => {
    setOpen(null);
  }, [pathname]);

  return (
    <nav
      ref={wrapRef}
      aria-label={t("nav.mainLabel", "Main")}
      // Below lg the menu sheet and the tab bar carry navigation —
      // five pills with panels do not fit at 360px without becoming a
      // row of guesses.
      // ml-4 on top of the header's own gap-2 — the nav is a different
      // thing from the wordmark and needs to read as one, not as a
      // sixth pill in the same row.
      className="hidden lg:flex items-center gap-0.5 lg:ml-4"
    >
      <Link
        href="/"
        className={`flex h-9 items-center gap-2 rounded-[10px] px-3 text-[13px] font-medium transition-colors ${
          isActive("/", pathname)
            ? "bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)]"
            : "text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-text)]"
        }`}
      >
        <NavIcon name="home" size={15} />
        {t("nav.home", "Home")}
      </Link>

      {NAV_GROUPS.map((group) => {
        const groupActive = group.children.some((c) => isActive(c.href, pathname));
        const isOpen = open === group.key;
        return (
          <div
            key={group.key}
            className="relative"
            onMouseEnter={() => {
              cancelClose();
              setOpen(group.key);
            }}
            onMouseLeave={scheduleClose}
          >
            <div className="flex items-center">
              <Link
                href={group.href}
                className={`flex h-9 items-center gap-2 rounded-l-[10px] pl-3 pr-1.5 text-[13px] font-medium transition-colors ${
                  groupActive || isOpen
                    ? "bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)]"
                    : "text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-text)]"
                }`}
              >
                <NavIcon name={group.icon} size={15} />
                {text[group.key]}
              </Link>
              {/*
                A separate button, not a chevron inside the link. On a
                tablet the whole pill being a link means the first tap
                navigates and the panel is unreachable; splitting them
                gives touch and keyboard a target that only opens.
              */}
              <button
                type="button"
                aria-expanded={isOpen}
                aria-haspopup="true"
                aria-label={t("nav.groupMenu", "{group} menu", { group: text[group.key] })}
                onPointerDown={() => {
                  wasOpen.current = open === group.key;
                }}
                onClick={() => setOpen(wasOpen.current ? null : group.key)}
                onFocus={() => setOpen(group.key)}
                className={`flex h-9 items-center rounded-r-[10px] pl-0.5 pr-2 transition-colors ${
                  groupActive || isOpen
                    ? "bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)]"
                    : "text-[color:var(--color-text-subtle)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-text)]"
                }`}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden
                  className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                >
                  <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {isOpen && (
              <div
                className="absolute left-0 top-full z-50 pt-2"
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
              >
                <div className="min-w-[268px] overflow-hidden rounded-[14px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] py-1.5 shadow-elevated">
                  {group.children.map((c) => {
                    const childActive = isActive(c.href, pathname);
                    return (
                      <Link
                        key={c.href}
                        href={c.href}
                        className={`flex items-start gap-2.5 px-3.5 py-2.5 transition-colors ${
                          childActive
                            ? "bg-[color:var(--color-brand-soft)]"
                            : "hover:bg-[color:var(--color-surface-hover)]"
                        }`}
                      >
                        <span className="mt-0.5 shrink-0 text-[color:var(--color-brand)]">
                          <NavIcon name={c.icon} size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13.5px] font-medium leading-tight">
                            {text[c.key]}
                          </span>
                          <span className="mt-0.5 block text-[11.5px] leading-snug text-[color:var(--color-text-subtle)]">
                            {text[`${c.key}.blurb`]}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
