/**
 * Shell for the standalone information pages — terms, privacy, contact.
 *
 * These sit outside the app shell (no sidebars, no bottom nav) but they
 * are still part of the site, so they carry the same header and footer
 * as the landing page. Someone who lands on /privacy from a search
 * result should be able to sign in, or get to the front door, without
 * hitting the back button.
 */

import { getCurrentUser } from "@/lib/user-auth";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

export async function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    // Flex column so a short page (contact) still pins the footer to the
    // bottom of the viewport instead of leaving it a scroll away.
    <div className="flex min-h-dvh flex-col bg-[color:var(--color-surface)]">
      <SiteHeader user={user} />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16">
          <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.025em] sm:text-[44px]">
            {title}
          </h1>
          <p className="mt-2 text-[13.5px] text-[color:var(--color-text-subtle)]">
            Last updated {updated}
          </p>

          {/* Sections span the full width and split heading from body on
              large screens. Loose paragraphs the page passes in at the top
              level get held to a readable measure — a lone sentence run
              across 72rem is unreadable no matter how wide the page is. */}
          <div className="mt-10 space-y-9 text-[15.5px] leading-relaxed text-[color:var(--color-text-muted)] [&>p]:max-w-3xl">
            {children}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-x-10 gap-y-3 border-t border-[color:var(--color-border-soft)] pt-8 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
      <h2 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-[color:var(--color-text)]">
        {heading}
      </h2>
      <div className="max-w-3xl space-y-3">{children}</div>
    </section>
  );
}
