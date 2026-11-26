/**
 * Shared header shell for every /admin/settings/* page.
 *
 * Provides the page title, subtitle, and (on tablet-and-up) a row of
 * pill-tabs that mirror the sidebar's Settings sub-tree. On mobile
 * the tabs collapse into a horizontal-scroll strip so the person
 * always knows where they are and can jump between sub-pages
 * without opening the drawer.
 *
 * Per DESIGN_RULES.md: full page width, responsive padding, no
 * artificial max-w.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "General", href: "/admin/settings/general" },
  { label: "Email", href: "/admin/settings/email" },
  { label: "Email templates", href: "/admin/settings/email-templates" },
  { label: "Storage", href: "/admin/settings/storage" },
  { label: "Media / ffmpeg", href: "/admin/settings/ffmpeg" },
  { label: "Live streaming", href: "/admin/settings/streaming" },
  { label: "Stripe", href: "/admin/settings/payments" },
  { label: "Payouts", href: "/admin/settings/payouts" },
  { label: "Cache", href: "/admin/settings/cache" },
];

export function SettingsShell({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const stripRef = useRef<HTMLDivElement>(null);

  // On narrow viewports keep the active pill in view — it makes the
  // strip actually usable one-handed.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const active = strip.querySelector<HTMLAnchorElement>('[data-active="true"]');
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-[14px] text-[color:var(--color-text-muted)]">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>

      {/* Sub-page tabs. Horizontal scroll on mobile, wraps on tablet+. */}
      <div
        ref={stripRef}
        className="flex gap-1.5 overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pb-1 no-scrollbar"
      >
        {TABS.map((t) => {
          const active =
            pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              data-active={active ? "true" : "false"}
              className={cn(
                "shrink-0 whitespace-nowrap px-3.5 h-9 inline-flex items-center rounded-full text-[13px] font-medium transition-colors",
                active
                  ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)] shadow-[var(--shadow-brand)]"
                  : "bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] border border-[color:var(--color-border)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-border-strong)]",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div>{children}</div>
    </div>
  );
}
