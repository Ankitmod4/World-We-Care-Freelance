"use client";

/**
 * The category picker in the gratitude composer.
 *
 * Shared because the two pages are the same page with different words,
 * and because the rule that matters — an uncategorised post is normal
 * and must still be reachable — is easy to get subtly different in two
 * places.
 *
 * THERE USED TO BE A FILTER ROW HERE, and a per-post tag to go with
 * it. Both are gone: the walls show categories as tiles that open a
 * page each (EntryCategoryTiles), which is what let the "Everything"
 * chip stop existing. It was never a category — it was the absence of
 * a filter, a control whose only job was to undo the control beside
 * it. The post's category is now a link on the entry's own page.
 */

import { useEffect, useState } from "react";
import { useT } from "./locale-context";

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  emoji: string | null;
}

/** Load the active categories for one kind. Empty until an admin adds
 *  some, in which case every control below renders nothing. */
export function useCategories(kind: "gratitude"): PublicCategory[] {
  const [cats, setCats] = useState<PublicCategory[]>([]);
  useEffect(() => {
    let alive = true;
    void fetch(`/api/public/categories?kind=${kind}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { categories?: PublicCategory[] } | null) => {
        if (alive) setCats(d?.categories ?? []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [kind]);
  return cats;
}

/**
 * The composer's picker.
 *
 * `required` makes the empty option a PROMPT rather than a choice:
 * it reads "Choose a category" instead of "No category", and it is
 * `disabled` so it cannot be selected back to blank once a real one
 * has been picked. The caller is expected to keep its submit button
 * disabled to match — the select cannot do that itself, and a
 * required field whose form still submits is worse than an optional
 * one.
 *
 * WITH NO CATEGORIES THIS RENDERS NOTHING, and nothing is required.
 * A community whose admin has not made any yet must still be able to
 * post; `hasCategories` on the server draws the same line, and the
 * two have to agree or the button and the API disagree about whether
 * the composer works.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  disabled,
  required,
}: {
  categories: PublicCategory[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const t = useT();
  if (categories.length === 0) return null;

  const unset = required && !value;

  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="sr-only">{t("live.category", "Category")}</span>
      <select
        value={value ?? ""}
        disabled={disabled}
        required={required}
        aria-required={required || undefined}
        onChange={(e) => onChange(e.target.value || null)}
        className={
          "h-9 max-w-[190px] rounded-full border bg-[color:var(--color-surface)] px-3 text-[12.5px] font-medium focus:border-[color:var(--color-brand)] focus:outline-none disabled:opacity-50 " +
          // Waiting on you, without shouting. A red border on a field
          // nobody has touched yet reads as an error the reader has
          // already made, which on this of all pages is the wrong
          // first impression.
          (unset
            ? "border-[color:var(--color-brand)]/70 text-[color:var(--color-text)]"
            : "border-[color:var(--color-border)] text-[color:var(--color-text-muted)]")
        }
      >
        <option value="" disabled={required}>
          {required ? t("category.choose", "Choose a category") : t("category.none", "No category")}
        </option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.emoji ? `${c.emoji} ` : ""}
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
