"use client";

import { cn } from "@/lib/utils";

export function StatusPill({ active }: { active: boolean }) {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[color:var(--color-success-soft)] text-[color:var(--color-success-ink)] border border-[color:var(--color-success-soft)] text-[10.5px] font-medium">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-[color:var(--color-success)] animate-ping opacity-75" />
          <span className="relative rounded-full h-1.5 w-1.5 bg-[color:var(--color-success)]" />
        </span>
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[color:var(--color-surface-hover)] text-[color:var(--color-text-muted)] text-[10.5px] font-medium">
      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-text-subtle)]" />
      Inactive
    </span>
  );
}

export function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)]",
        className,
      )}
    >
      {children}
    </th>
  );
}
