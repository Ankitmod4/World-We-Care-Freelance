import type { Metadata } from "next";
import Link from "next/link";
import { CategoryManager } from "@/components/admin/category-manager";

export const metadata: Metadata = { title: "Gratitude categories" };

export default function AdminGratitudeCategoriesPage() {
  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div>
        <Link
          href="/admin/gratitude"
          className="text-[13px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)]"
        >
          ← Gratitude
        </Link>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]">
          Gratitude categories
        </h1>
        <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
          What people can file an entry under, and what readers can filter by. Choosing one
          is optional.
        </p>
      </div>

      <CategoryManager
        endpoint="/api/admin/gratitude-categories"
        noun="entry"
        placeholder="Small wins, People who helped, Milestones…"
      />
    </div>
  );
}
