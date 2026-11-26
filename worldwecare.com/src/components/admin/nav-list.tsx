"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ADMIN_NAV_SECTIONS, type NavChildBadge, type NavItem } from "./nav-config";
import { ReportsCountBadge } from "./reports-count-badge";

// Map badge keys → client components. Kept here (in the renderer)
// so nav-config.tsx stays declarative and server-safe.
function renderChildBadge(badge?: NavChildBadge) {
  if (!badge) return null;
  if (badge === "reports-open-count") return <ReportsCountBadge />;
  return null;
}

/**
 * Which section holds this route, or the first real one if none does.
 *
 * Falling back to the first section rather than to nothing is
 * deliberate: standing on the dashboard, every section would
 * otherwise be shut and the sidebar would read as a list of five
 * words with no way to tell it is working.
 */
function sectionFor(pathname: string): string | null {
  for (const s of ADMIN_NAV_SECTIONS) {
    if (!s.title) continue;
    const hit = s.items.some(
      (i) => isActive(i.href, pathname) || i.children?.some((c) => isActive(c.href, pathname)),
    );
    if (hit) return s.title;
  }
  return ADMIN_NAV_SECTIONS.find((s) => s.title)?.title ?? null;
}

/**
 * Shared nav renderer used by both the desktop sidebar and the
 * mobile drawer. Handles collapsible parents: any item with
 * `children` becomes an expandable group. Auto-opens when the
 * current pathname lives inside it.
 *
 * ── WHY THE SECTIONS COLLAPSE TOO ──
 *
 * Twenty-three destinations laid out flat is 1,340px of nav, which
 * scrolls on any normal laptop — so the bottom of the panel was
 * hidden behind a scroll nobody thinks to perform in a sidebar. One
 * section open at a time keeps the whole thing on screen.
 *
 * It is an accordion rather than independent toggles because two
 * sections open is already taller than most screens, which would put
 * the problem straight back. A section with a `null` title is pinned:
 * no header, no toggle, always visible.
 *
 * `variant` tweaks tap-target sizing — mobile needs ≥ 44px per
 * DESIGN_RULES.md.
 */
export function NavList({
  variant = "desktop",
  onNavigate,
}: {
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const rowH = variant === "mobile" ? "min-h-11 text-[14px]" : "h-9 text-[13.5px]";
  const childRowH =
    variant === "mobile" ? "min-h-11 text-[13.5px]" : "h-8 text-[13px]";
  const headerH = variant === "mobile" ? "min-h-11" : "h-8";

  const here = sectionFor(pathname);
  const active = activeHref(pathname);
  const [open, setOpen] = useState<string | null>(here);
  /*
     Follow the route, but do not fight the person. Navigating into
     another section opens it; a section they opened by hand stays
     open until they navigate away from where they were.
  */
  useEffect(() => setOpen(here), [here]);

  return (
    <>
      {ADMIN_NAV_SECTIONS.map((section, i) => {
        const rows = (
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavRow
                key={item.href}
                item={item}
                pathname={pathname}
                active={active}
                rowH={rowH}
                childRowH={childRowH}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        );

        // A section with no title is pinned open and gets no header —
        // a lone Dashboard row does not need a heading and a chevron.
        if (!section.title) return <div key={`pinned-${i}`}>{rows}</div>;

        const isOpen = open === section.title;
        return (
          <div key={section.title}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : section.title)}
              aria-expanded={isOpen}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-[10px] px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] transition-colors duration-150",
                headerH,
                isOpen
                  ? "text-[color:var(--color-text-muted)]"
                  : "text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-hover)]",
              )}
            >
              <span>{section.title}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden
                className={cn("transition-transform duration-150", isOpen ? "rotate-90" : "rotate-0")}
              >
                <path
                  d="M4 3l4 3-4 3"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {isOpen && <div className="mt-1.5">{rows}</div>}
          </div>
        );
      })}
    </>
  );
}

/** Does this href own the current page, or a page beneath it? */
function isActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * The ONE row that should light up.
 *
 * Prefix matching on its own lights two: standing on
 * /admin/events/categories, "All events" (/admin/events) matches
 * every bit as well as "Categories" (/admin/events/categories) does,
 * and both rows come up blue. It is true of every group whose first
 * child is the parent's own index — Posts/Feed, Chatrooms/Rooms,
 * Articles/All articles, and so on — so it was on screen somewhere
 * most of the time.
 *
 * The longest matching href is always the more specific page, so that
 * is the one, and every other row is left alone.
 */
function activeHref(pathname: string): string | null {
  let best: string | null = null;
  for (const section of ADMIN_NAV_SECTIONS) {
    for (const item of section.items) {
      for (const href of [item.href, ...(item.children ?? []).map((c) => c.href)]) {
        if (isActive(href, pathname) && (best === null || href.length > best.length)) best = href;
      }
    }
  }
  return best;
}

function NavRow({
  item,
  pathname,
  active,
  rowH,
  childRowH,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  /** The single winning href — see `activeHref`. */
  active: string | null;
  rowH: string;
  childRowH: string;
  onNavigate?: () => void;
}) {
  // A LEAF lights only if it won outright; a GROUP HEADER lights
  // whenever the current page is anywhere beneath it, which is what
  // prefix matching is for.
  const activeSelf = item.href === active;
  const isGroupActive =
    isActive(item.href, pathname) ||
    (item.children?.some((c) => isActive(c.href, pathname)) ?? false);

  // Local expanded state — collapse other groups by default so the
  // sidebar stays tidy. Auto-expand + stay expanded if we're inside.
  const [open, setOpen] = useState(isGroupActive);
  useEffect(() => {
    if (isGroupActive) setOpen(true);
  }, [isGroupActive]);

  if (!item.children || item.children.length === 0) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2.5 px-3 rounded-[10px] transition-colors",
          rowH,
          activeSelf
            ? "bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] font-medium"
            : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)]",
        )}
      >
        <span
          className={cn(
            "shrink-0",
            activeSelf
              ? "text-[color:var(--color-brand)]"
              : "text-[color:var(--color-text-subtle)]",
          )}
        >
          {item.icon}
        </span>
        <span>{item.label}</span>
      </Link>
    );
  }

  // Collapsible group. The header is a BUTTON (toggle), not a link,
  // because tapping "Settings" should reveal children, not navigate
  // to /admin/settings (which typically doesn't have its own page).
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex items-center justify-between gap-2.5 px-3 rounded-[10px] w-full transition-colors",
          rowH,
          isGroupActive
            ? "text-[color:var(--color-text)] font-medium"
            : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)]",
        )}
      >
        <span className="flex items-center gap-2.5">
          <span
            className={cn(
              "shrink-0",
              isGroupActive
                ? "text-[color:var(--color-brand)]"
                : "text-[color:var(--color-text-subtle)]",
            )}
          >
            {item.icon}
          </span>
          <span>{item.label}</span>
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
          className={cn(
            "transition-transform duration-150 text-[color:var(--color-text-subtle)]",
            open ? "rotate-90" : "rotate-0",
          )}
        >
          <path
            d="M4 3l4 3-4 3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="mt-0.5 pl-8 space-y-0.5">
          {item.children.map((c) => {
            const childActive = c.href === active;
            const badge = renderChildBadge(c.badge);
            return (
              <Link
                key={c.href}
                href={c.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center justify-between gap-2 px-3 rounded-[10px] transition-colors",
                  childRowH,
                  childActive
                    ? "bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] font-medium"
                    : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)]",
                )}
              >
                <span>{c.label}</span>
                {badge}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
