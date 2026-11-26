"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavList } from "./nav-list";

/**
 * Admin mobile / tablet drawer.
 *
 * Slides in from the left over a scrim. Closes on backdrop tap,
 * escape key, or route change. Nav rendering lives inside NavList
 * so both surfaces stay in perfect sync (including the collapsible
 * Settings sub-tree).
 */
export function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div
      className={cn(
        "md:hidden fixed inset-0 z-50 transition-opacity",
        open
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <aside
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[86%] max-w-[320px]",
          "bg-[color:var(--color-surface)] shadow-[var(--shadow-elevated)] flex flex-col",
          "transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-[color:var(--color-border-soft)]">
          <div className="flex items-center gap-2.5">
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
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="min-h-11 min-w-11 flex items-center justify-center rounded-[10px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)]"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
          <NavList variant="mobile" onNavigate={onClose} />
        </nav>
      </aside>
    </div>
  );
}

function Logo() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden>
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
