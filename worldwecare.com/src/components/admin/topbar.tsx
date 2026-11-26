"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MobileDrawer } from "./mobile-drawer";
import { NotificationsBell } from "./notifications-bell";

/**
 * Admin topbar. Sticky, translucent, blurred (macOS toolbar vibe).
 * On mobile / tablet the sidebar collapses and a hamburger button
 * opens the MobileDrawer. Sign-out button always visible.
 */
export function Topbar({
  displayName,
  email,
}: {
  displayName: string;
  email: string;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const initials = displayName
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const onSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <>
      <header className="chrome sticky top-0 z-30 h-16 flex items-center justify-between px-4 sm:px-6 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {/* Hamburger — visible only when the sidebar is hidden. */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="md:hidden min-h-11 min-w-11 -ml-2 flex items-center justify-center rounded-[10px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)]"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M3 6h14M3 10h14M3 14h14"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="hidden sm:block text-[13px] text-[color:var(--color-text-muted)] leading-none">
              Signed in as
            </p>
            <p className="text-[14px] font-medium truncate">{email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <NotificationsBell />
          <span className="hidden sm:inline-flex items-center justify-center h-9 w-9 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] text-[13px] font-semibold">
            {initials || "?"}
          </span>
          <button
            onClick={onSignOut}
            disabled={signingOut}
            className="min-h-11 sm:min-h-9 px-3.5 rounded-[10px] text-[13px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)] transition-colors disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
