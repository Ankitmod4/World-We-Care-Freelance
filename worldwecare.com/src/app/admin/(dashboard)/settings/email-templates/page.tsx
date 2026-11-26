import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { SettingsShell } from "@/components/admin/settings-shell";

export const metadata: Metadata = { title: "Email templates" };

export default async function EmailTemplatesPage() {
  const items = await prisma.emailTemplate.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      subject: true,
      enabled: true,
      updatedAt: true,
    },
  });

  return (
    <SettingsShell
      title="Email templates"
      subtitle="Edit subject line and HTML body for every transactional email. Variables use {{name}} syntax."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
        {items.map((t) => (
          <TemplateCard
            key={t.id}
            href={`/admin/settings/email-templates/${t.id}`}
            slug={t.slug}
            name={t.name}
            description={t.description}
            subject={t.subject}
            enabled={t.enabled}
            updatedAt={t.updatedAt.toISOString()}
          />
        ))}
      </div>
    </SettingsShell>
  );
}

/**
 * Rich template card.
 *
 * Three-layer hierarchy:
 *   1. Icon + status chip anchor the top-left / top-right
 *   2. Name (large) + slug (mono chip) row
 *   3. Description (2-line clamp) + subject preview
 *   4. Footer with "Updated Xd ago" + arrow-reveal on hover
 *
 * The whole card is a link — hover lifts it slightly and reveals
 * an arrow chevron on the right, so the tap target reads as
 * navigable at a glance.
 */
function TemplateCard({
  href,
  slug,
  name,
  description,
  subject,
  enabled,
  updatedAt,
}: {
  href: string;
  slug: string;
  name: string;
  description: string | null;
  subject: string;
  enabled: boolean;
  updatedAt: string;
}) {
  const icon = pickIcon(slug);
  return (
    <Link
      href={href}
      className="group relative block rounded-[16px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-5 shadow-[var(--shadow-card)] hover:border-[color:var(--color-brand)] hover:shadow-[var(--shadow-elevated)] hover:-translate-y-0.5 transition-all"
    >
      {/* Header — icon + status */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <span
          className={
            "inline-flex items-center justify-center h-10 w-10 rounded-[12px] " +
            (enabled
              ? "bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand)]"
              : "bg-[color:var(--color-surface-hover)] text-[color:var(--color-text-subtle)]")
          }
        >
          {icon}
        </span>
        <StatusChip enabled={enabled} />
      </div>

      {/* Title + slug */}
      <div className="space-y-1.5">
        <h3 className="text-[15.5px] font-semibold tracking-[-0.01em] text-[color:var(--color-text)]">
          {name}
        </h3>
        <code className="inline-block px-1.5 py-0.5 rounded bg-[color:var(--color-surface-muted)] text-[10.5px] font-mono text-[color:var(--color-text-muted)]">
          {slug}
        </code>
      </div>

      {/* Description */}
      {description && (
        <p className="mt-3 text-[13px] text-[color:var(--color-text-muted)] leading-relaxed line-clamp-2">
          {description}
        </p>
      )}

      {/* Subject preview */}
      <div className="mt-4 rounded-[10px] bg-[color:var(--color-surface-muted)] px-3 py-2">
        <p className="text-[10.5px] uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)] font-semibold">
          Subject
        </p>
        <p className="text-[12.5px] text-[color:var(--color-text)] mt-0.5 line-clamp-1">
          {subject}
        </p>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-[color:var(--color-border-soft)] flex items-center justify-between">
        <span className="text-[11.5px] text-[color:var(--color-text-subtle)]">
          Updated {relativeTime(updatedAt)}
        </span>
        <span className="text-[color:var(--color-brand)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all inline-flex items-center gap-1 text-[12px] font-medium">
          Edit
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M4 3l4 3-4 3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </Link>
  );
}

function StatusChip({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[color:var(--color-success-soft)] border border-[color:var(--color-success-soft)] text-[color:var(--color-success-ink)] text-[10.5px] font-medium">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-[color:var(--color-success)] animate-ping opacity-75" />
          <span className="relative rounded-full h-1.5 w-1.5 bg-[color:var(--color-success)]" />
        </span>
        Live
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[color:var(--color-surface-hover)] text-[color:var(--color-text-subtle)] text-[10.5px] font-medium">
      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-text-subtle)]" />
      Disabled
    </span>
  );
}

/** Pick an evocative icon per slug. Falls back to a generic envelope
 *  for custom templates the admin adds later. */
function pickIcon(slug: string): React.ReactNode {
  const c = "currentColor";
  const props = { width: 18, height: 18, viewBox: "0 0 20 20", fill: "none" as const };
  switch (slug) {
    case "welcome":
      return (
        // hand waving
        <svg {...props} aria-hidden>
          <path
            d="M6 10V6.5a1.5 1.5 0 013 0V10M9 9.5V5a1.5 1.5 0 013 0v5M12 8.5V6a1.5 1.5 0 013 0v6.5c0 2.8-2.5 4.5-5 4.5s-4.5-1.2-5-3.5L4 11c-.4-1 .3-1.8 1.2-1.8.5 0 .9.3 1.1.7"
            stroke={c}
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "email_confirm":
      return (
        // envelope with check
        <svg {...props} aria-hidden>
          <path
            d="M3 6a2 2 0 012-2h10a2 2 0 012 2v5a2 2 0 01-2 2h-5"
            stroke={c}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path d="M3 6l7 5 7-5" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
          <path
            d="M6 15l2 2 4-4"
            stroke={c}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "password_reset":
      return (
        // key
        <svg {...props} aria-hidden>
          <circle cx="7" cy="13" r="3" stroke={c} strokeWidth="1.4" />
          <path
            d="M9.5 11L17 3.5M14 6l2 2"
            stroke={c}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "password_reset_confirmed":
      return (
        // shield check
        <svg {...props} aria-hidden>
          <path
            d="M10 3l6 2v5c0 4-3 6.5-6 7-3-.5-6-3-6-7V5l6-2z"
            stroke={c}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M7.5 10l2 2 3-3.5"
            stroke={c}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        // generic envelope
        <svg {...props} aria-hidden>
          <rect x="3" y="4" width="14" height="12" rx="2" stroke={c} strokeWidth="1.4" />
          <path d="M3 6l7 5 7-5" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
  }
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}
