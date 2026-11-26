/**
 * One icon set for every navigation surface.
 *
 * The sidebar, the mobile tab bar and the menu sheet all drew their own
 * — three files, three viewBoxes, three stroke weights, and a Places
 * pin that looked like a different pin depending on where you saw it.
 * These are all 24×24 with a 1.7 stroke and take a size, so a 20px
 * sidebar row and a 26px menu tile are the same drawing at two scales.
 *
 * `currentColor` throughout: colour is the caller's business.
 */

export type NavIconName =
  | "home"
  | "search"
  | "chat"
  | "calendar"
  | "pin"
  | "megaphone"
  | "petition"
  | "article"
  | "clip"
  | "heart"
  | "confess"
  | "mail"
  | "bookmark"
  | "bell"
  | "user"
  | "settings"
  | "live"
  | "globe"
  | "star"
  | "journal"
  | "spark"
  | "card";

const PATHS: Record<NavIconName, React.ReactNode> = {
  // Broadcast waves, not a camera: this is "someone is on air right
  // now", which is a different idea from "a video call".
  live: (
    <>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M8.2 8.2a5.4 5.4 0 000 7.6M15.8 8.2a5.4 5.4 0 010 7.6" />
      <path d="M5.4 5.4a9.3 9.3 0 000 13.2M18.6 5.4a9.3 9.3 0 010 13.2" />
    </>
  ),
  home: <path d="M3.5 10.5L12 4l8.5 6.5V19a1 1 0 01-1 1h-4.5v-5.5h-6V20H4.5a1 1 0 01-1-1v-8.5z" />,
  // A card rather than a coin or a banknote: this covers giving AND
  // being paid, and a currency symbol would have to pick one country.
  card: (
    <>
      <rect x="3" y="6" width="18" height="12.5" rx="2.5" />
      <path d="M3 10.5h18" />
      <path d="M6.5 15h3" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l4.5 4.5" />
    </>
  ),
  chat: <path d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v7a2.5 2.5 0 01-2.5 2.5H9l-5 4v-4H6.5A2.5 2.5 0 014 13.5v-7z" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M8.5 3.5v3M15.5 3.5v3" />
    </>
  ),
  pin: (
    <>
      <path d="M12 20.5s6.5-5.6 6.5-10.7A6.5 6.5 0 105.5 9.8C5.5 14.9 12 20.5 12 20.5z" />
      <circle cx="12" cy="9.8" r="2.4" />
    </>
  ),
  megaphone: (
    <>
      <path d="M5 9.5v4A1.5 1.5 0 006.5 15H8.5l7.5 4V6L8.5 9.5H6.5A1.5 1.5 0 005 11z" />
      <path d="M8.5 15v4" />
    </>
  ),
  /* A sheet with a signature line — a petition is a document people
     put their name to, and reusing the megaphone would make it
     indistinguishable from Campaigns in the sidebar. */
  petition: (
    <>
      <path d="M6 3.5h8.5L18 7v13.5H6V3.5z" />
      <path d="M14 3.5V7h4" />
      <path d="M9 16.5c1.2-1.6 2-2.4 2.6-2.4.9 0 .5 2.2 1.4 2.2.6 0 1-.7 2-1.8" />
    </>
  ),
  article: (
    <>
      <path d="M6 3.5h8.5L19 8v12.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-16a1 1 0 011-1z" />
      <path d="M14 3.5V8h4.5M8.5 12.5h7M8.5 16h4.5" />
    </>
  ),
  clip: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="2.5" />
      <path d="M16 11l5-2.75v7.5L16 13" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0112 6.2a4.5 4.5 0 017.5 3.8c0 5.4-7.5 10-7.5 10z" />,
  confess: (
    <>
      <path d="M4.5 5.5A1.5 1.5 0 016 4h12a1.5 1.5 0 011.5 1.5v9A1.5 1.5 0 0118 16H9.5L4.5 20V5.5z" />
      <path d="M9 10h6" />
    </>
  ),
  mail: (
    <>
      <rect x="3.25" y="5.5" width="17.5" height="13" rx="2.5" />
      <path d="M4 7.5l8 5 8-5" />
    </>
  ),
  bookmark: <path d="M6 4h12v16.5l-6-4.5-6 4.5V4z" />,
  // A closed notebook, not an open book: the journal is the one thing
  // on this site nobody else opens.
  journal: (
    <>
      <path d="M6.5 3.5h11a1 1 0 011 1v15a1 1 0 01-1 1h-11a2 2 0 01-2-2v-13a2 2 0 012-2z" />
      <path d="M4.5 17.5h13" />
    </>
  ),
  // Progress. A spark rather than a trophy — nobody won anything.
  spark: (
    <>
      <path d="M12 3.5l1.7 4.8 4.8 1.7-4.8 1.7L12 16.5l-1.7-4.8-4.8-1.7 4.8-1.7L12 3.5z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
    </>
  ),
  // Town Heroes. A star rather than a medal or a trophy: this is
  // recognition from neighbours, not a competition somebody won.
  star: (
    <path d="M12 3.6l2.55 5.17 5.7.83-4.12 4.02.97 5.68L12 16.6l-5.1 2.68.97-5.68-4.12-4.02 5.7-.83L12 3.6z" />
  ),
  bell: (
    <>
      <path d="M6.5 9.5a5.5 5.5 0 0111 0c0 3.2.8 4.7 1.5 5.5H5c.7-.8 1.5-2.3 1.5-5.5z" />
      <path d="M10 18.5a2 2 0 004 0" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.2 2.3 3.4 5.3 3.4 8.5S14.2 18.2 12 20.5c-2.2-2.3-3.4-5.3-3.4-8.5S9.8 5.8 12 3.5z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.6 1.6 0 00.32 1.77l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.6 1.6 0 00-1.77-.32 1.6 1.6 0 00-1 1.47V21a2 2 0 01-4 0v-.11a1.6 1.6 0 00-1.05-1.46 1.6 1.6 0 00-1.77.32l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.6 1.6 0 004.6 15a1.6 1.6 0 00-1.47-1H3a2 2 0 010-4h.11A1.6 1.6 0 004.6 8.9a1.6 1.6 0 00-.33-1.77l-.06-.06a2 2 0 012.83-2.83l.06.06a1.6 1.6 0 001.77.33H9a1.6 1.6 0 001-1.47V3a2 2 0 014 0v.11a1.6 1.6 0 001 1.47 1.6 1.6 0 001.77-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.6 1.6 0 00-.33 1.77V9a1.6 1.6 0 001.47 1H21a2 2 0 010 4h-.11a1.6 1.6 0 00-1.47 1z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.5 20c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5" />
    </>
  ),
};

export function NavIcon({
  name,
  size = 20,
  className,
}: {
  name: NavIconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
