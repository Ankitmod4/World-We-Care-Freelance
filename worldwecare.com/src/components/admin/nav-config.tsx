/**
 * Shared admin nav config — one source of truth for the desktop
 * sidebar AND the mobile drawer. Adding a nav entry in one place
 * updates both surfaces automatically.
 *
 * ── HOW IT IS SHAPED, AND WHY ──
 *
 * There are twenty-three places to go in this admin panel, and laid
 * out flat that is 1,340px of sidebar — it scrolled on any normal
 * laptop, so the bottom third of the panel was effectively hidden.
 * Three things keep it short:
 *
 *   SECTIONS COLLAPSE. Only the section you are currently inside is
 *   open. `NavList` handles it; a section with a `null` title is
 *   pinned open with no header at all, which is what Dashboard uses.
 *
 *   EVERY SUB-PAGE IS A CHILD OF ITS PARENT. "Event categories" used
 *   to sit beside "Events" as a sibling, which was both a longer list
 *   and a bug: `/admin/events/categories` lit up BOTH rows, because
 *   an item is active when the path starts with its href.
 *
 *   SETTINGS HAS NO CHILDREN HERE. Its twelve sub-pages are already
 *   listed as pill-tabs by `SettingsShell` on every one of those
 *   pages, so repeating them in the sidebar was twelve rows to say
 *   what the page itself says better. The row links to
 *   /admin/settings, which redirects to the first tab.
 *
 * Items can optionally declare `children`, which turns them into a
 * collapsible group. The parent auto-expands whenever any child is
 * the current route.
 */

import type { ReactNode } from "react";

/** Optional slot for a live badge next to a child link. Keyed as
 *  a string rather than a ReactNode so this config module stays
 *  safe to import from server components — the sidebar renderer
 *  maps the key to the actual client component. */
export type NavChildBadge = "reports-open-count";

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  children?: Array<{ label: string; href: string; badge?: NavChildBadge }>;
}

export interface NavSection {
  /**
   * `null` pins the section's items at the top of the sidebar with no
   * header and no toggle. A one-item section does not deserve a
   * heading and a chevron.
   */
  title: string | null;
  items: NavItem[];
}

export const ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    title: null,
    items: [{ label: "Dashboard", href: "/admin", icon: <IconDashboard /> }],
  },
  {
    title: "Community",
    items: [
      {
        /*
          Everything about people in one group: the members, the
          people who administer them, and the words none of them may
          use. Admins and Banned words were top-level rows wearing the
          same shield icon as each other.
        */
        label: "People",
        href: "/admin/users",
        icon: <IconUsers />,
        children: [
          { label: "Members", href: "/admin/users" },
          { label: "Admins", href: "/admin/admins" },
          { label: "Banned words", href: "/admin/banned-words" },
        ],
      },
      {
        label: "Posts",
        href: "/admin/posts",
        icon: <IconPost />,
        children: [
          { label: "Feed", href: "/admin/posts" },
          { label: "Reports", href: "/admin/posts/reports", badge: "reports-open-count" },
        ],
      },
      {
        label: "Chatrooms",
        href: "/admin/chatrooms",
        icon: <IconChat />,
        children: [
          { label: "Rooms", href: "/admin/chatrooms" },
          { label: "Categories", href: "/admin/chatrooms/categories" },
        ],
      },
      {
        label: "Gratitude",
        href: "/admin/gratitude",
        icon: <IconHeart />,
        children: [
          { label: "All entries", href: "/admin/gratitude" },
          { label: "Categories", href: "/admin/gratitude/categories" },
        ],
      },
    ],
  },
  {
    title: "Content",
    items: [
      {
        label: "Articles",
        href: "/admin/articles",
        icon: <IconArticle />,
        children: [
          { label: "All articles", href: "/admin/articles" },
          { label: "Categories", href: "/admin/articles/categories" },
        ],
      },
      {
        label: "Events",
        href: "/admin/events",
        icon: <IconCalendar />,
        children: [
          { label: "All events", href: "/admin/events" },
          { label: "Categories", href: "/admin/events/categories" },
        ],
      },
      { label: "Petitions", href: "/admin/petitions", icon: <IconPetition /> },
      { label: "Campaigns", href: "/admin/campaigns", icon: <IconMegaphone /> },
      { label: "Places", href: "/admin/places", icon: <IconPin /> },
      {
        label: "Town Heroes",
        href: "/admin/town-heroes",
        icon: <IconStar />,
        children: [
          { label: "Nominations", href: "/admin/town-heroes" },
          { label: "Categories", href: "/admin/town-heroes/categories" },
        ],
      },
      {
        label: "Live",
        href: "/admin/live",
        icon: <IconLive />,
        children: [
          { label: "Broadcasts", href: "/admin/live" },
          { label: "Categories", href: "/admin/live/categories" },
        ],
      },
      { label: "Library", href: "/admin/library", icon: <IconClip /> },
      { label: "Daily reflections", href: "/admin/daily-reflections", icon: <IconQuote /> },
    ],
  },
  {
    /* Money was scattered through Community, with Payouts wearing the
       same heart as Gratitude. */
    title: "Money",
    items: [
      { label: "Donations", href: "/admin/donations", icon: <IconCard /> },
      { label: "Payouts", href: "/admin/payouts", icon: <IconWallet /> },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Geography", href: "/admin/geography", icon: <IconMap /> },
      {
        label: "Translations",
        href: "/admin/translations",
        icon: <IconGlobe />,
        children: [
          { label: "Languages", href: "/admin/translations" },
          { label: "Settings", href: "/admin/translations/settings" },
        ],
      },
      {
        /* No children — see the note at the top. SettingsShell lists
           all twelve sub-pages as tabs on each of them. */
        label: "Settings",
        href: "/admin/settings",
        icon: <IconGear />,
      },
    ],
  },
];

/* ── Inline SVG icons ─────────────────────────────────────────── */

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="4.5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 8h14M7 3v3M13 3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconCard() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="4.5" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 8.5h15" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function IconHeart() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M10 16.5s-6-3.7-6-8A3.5 3.5 0 0110 5.2 3.5 3.5 0 0116 8.5c0 4.3-6 8-6 8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="6" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="11" y="3" width="6" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="3" y="12" width="6" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="11" y="9" width="6" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 17c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="14" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 17c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconPost() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 8h8M6 11h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 5.5A2 2 0 016 3.5h8a2 2 0 012 2v6a2 2 0 01-2 2h-3l-3 3v-3H6a2 2 0 01-2-2v-6z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}
function IconArticle() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M5 3h8l3 3v11a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 3v3h3M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconQuote() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path
        d="M6 8h3v3a3 3 0 01-3 3M11 8h3v3a3 3 0 01-3 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconGlobe() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 10h14M10 3c2.2 2 3.5 4.5 3.5 7s-1.3 5-3.5 7c-2.2-2-3.5-4.5-3.5-7s1.3-5 3.5-7z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 3v2M10 15v2M3 10h2M15 10h2M5 5l1.4 1.4M13.6 13.6L15 15M5 15l1.4-1.4M13.6 6.4L15 5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLive() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M8.2 8.2a5.4 5.4 0 000 7.6M15.8 8.2a5.4 5.4 0 010 7.6" />
      <path d="M5.4 5.4a9.3 9.3 0 000 13.2M18.6 5.4a9.3 9.3 0 010 13.2" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 2.8l2.1 4.3 4.7.7-3.4 3.3.8 4.7L10 13.6l-4.2 2.2.8-4.7L3.2 7.8l4.7-.7L10 2.8z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClip() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="4.5" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13.5 8.5l4-2.25v7.5l-4-2.25" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function IconMegaphone() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M4 8.5v3a1.5 1.5 0 001.5 1.5H7l7 3.5V5L7 8.5H5.5A1.5 1.5 0 004 10z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6.5 13.5V17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M10 17.5s5.5-4.7 5.5-9a5.5 5.5 0 10-11 0c0 4.3 5.5 9 5.5 9z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="10" cy="8.5" r="1.9" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** A sheet with a signature on it — not the calendar Events uses. */
function IconPetition() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M5 3h7l3 3v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 3v3h3M7 8h5M7 11h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5 17V4a1 1 0 011-1M6.5 15.5c1.5 0 1.5-2 3-2s1.5 2 3 2 1.5-2 3-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Money going out, as against the card Donations uses for money in. */
function IconWallet() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M3 6.5A1.5 1.5 0 014.5 5h10A1.5 1.5 0 0116 6.5v8a1.5 1.5 0 01-1.5 1.5h-10A1.5 1.5 0 013 14.5v-8z" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 8.5h11a1.5 1.5 0 011.5 1.5v1a1.5 1.5 0 01-1.5 1.5H3" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12.5" cy="10.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

/** A folded map — Translations already owns the globe. */
function IconMap() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M7.5 4L3 5.8v10L7.5 14l5 2 4.5-1.8v-10L12.5 6l-5-2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M7.5 4v10M12.5 6v10" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
