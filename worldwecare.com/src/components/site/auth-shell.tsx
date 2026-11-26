/**
 * The card every signed-out auth page sits in.
 *
 * Login, signup, forgot-password and reset-password were each carrying
 * their own copy of this markup, logo included. Four copies of a
 * layout is three chances for them to drift apart.
 */

import Link from "next/link";
import { getT } from "@/lib/i18n";

export async function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const t = await getT();
  return (
    <main className="hero-sky flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            href="/"
            aria-label={t("auth.homeAria", "WorldWeCare home")}
            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--color-surface)] shadow-[var(--shadow-elevated)]"
          >
            <Logo />
          </Link>
          <h1 className="mt-5 text-[26px] font-semibold tracking-[-0.02em]">{title}</h1>
          {subtitle && (
            <p className="mt-1.5 text-sm text-[color:var(--color-text-muted)]">{subtitle}</p>
          )}
        </div>

        <div className="card-elevated p-7">{children}</div>

        {footer && (
          <div className="mt-6 text-center text-sm text-[color:var(--color-text-muted)]">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}

export function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden>
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
