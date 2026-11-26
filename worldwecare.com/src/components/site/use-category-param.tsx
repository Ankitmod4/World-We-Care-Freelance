"use client";

/**
 * The active category, kept in the URL.
 *
 * `?category=housing` rather than component state alone, for three
 * reasons that all come from the same place: a tab is a view of the
 * page, and a view should have an address.
 *
 *  - It can be shared. "Look at the housing ones" is a link.
 *  - Back works. Tabbing through four categories and pressing back
 *    returns to the third, not to whatever page came before the whole
 *    section.
 *  - The old /x/category/[slug] pages can redirect here, so every link
 *    already in the wild keeps working.
 *
 * `replace`, not `push`, is DELIBERATELY NOT used: pushing is what
 * makes the back button do the useful thing above. `scroll: false`
 * because switching tab should swap the list, not throw the reader
 * back to the top of the page they are already reading.
 */

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useCategoryParam(): [string | null, (slug: string | null) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get("category");

  const set = useCallback(
    (slug: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (slug) next.set("category", slug);
      else next.delete("category");
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return [value, set];
}
