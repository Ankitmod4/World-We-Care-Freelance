import { NavList } from "./nav-list";

/**
 * Desktop admin sidebar. Hidden below md — the MobileDrawer takes
 * over there. All rendering lives inside NavList so nested /
 * collapsible items work identically across both surfaces.
 */
export function Sidebar() {
  return (
    <aside className="hidden md:flex md:flex-col w-[248px] shrink-0 h-screen sticky top-0 border-r border-[color:var(--color-border-soft)] frost">
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-[color:var(--color-border-soft)]">
        <Logo />
        <div className="leading-tight">
          <div className="text-[14px] font-semibold tracking-[-0.01em]">
            WorldWeCare
          </div>
          <div className="text-[11px] text-[color:var(--color-text-subtle)]">
            Admin
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        <NavList variant="desktop" />
      </nav>
    </aside>
  );
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden>
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
