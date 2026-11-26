"use client";

/**
 * /petitions — the index.
 *
 * Newest first, not most-signed. Ranking by signature count buries
 * every new petition under the same handful permanently, which is the
 * one outcome that stops anyone starting one — and starting one is
 * the behaviour this page exists to encourage. The count is on the
 * card, so the popular ones still read as popular.
 *
 * CATEGORIES ARE A TAB STRIP, not a grid of tiles. The tiles said the
 * right thing — here is what you could ask for — but spent a whole
 * screen saying it before a single petition. A strip says it in one
 * row, and the list starts underneath.
 *
 * "All" is a real tab here, which is not the same thing as the
 * "Everything" chip the walls had removed. That one sat BESIDE a tile
 * grid, where its only job was to undo the control next to it; in a
 * strip, the absence of a filter is one of the choices.
 *
 * The counts follow the country selector, because a tab saying 12 over
 * a list showing none is the country filter lying about itself.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { useCountry } from "./country-context";
import { PageHeading } from "./page-heading";
import { CategoryBrowse } from "./category-browse";
import { PetitionCard } from "./petition-card";
import type { PublicPetitionCategory } from "@/lib/petition-categories";
import { useT } from "./locale-context";

export interface PetitionCardDTO {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  target: string;
  goal: number | null;
  signatureCount: number;
  closesAt: string | null;
  creatorName: string;
  open: boolean;
  isMine: boolean;
  category: { id: string; name: string; slug: string; emoji: string | null; color: string | null } | null;
}

export function PetitionsClient({
  viewer,
}: {
  viewer: ShellViewer;
}) {
  const t = useT();
  const { countryId, country } = useCountry();
  const [categories, setCategories] = useState<PublicPetitionCategory[] | null>(null);

  // The CATEGORIES are still fetched here, because they are the page's
  // primary control and must be there on the first paint. The
  // PETITIONS are not: CategoryBrowse fetches them per tab, a page at
  // a time, which is what stopped this page drawing every petition in
  // the database at once.
  const load = useCallback(async () => {
    setCategories(null);
    const cat = new URLSearchParams();
    if (countryId) cat.set("countryId", countryId);
    const res = await fetch(`/api/public/petition-categories?${cat}`, {
      cache: "no-store",
    }).catch(() => null);
    const d = (await res?.json().catch(() => ({}))) as { categories?: PublicPetitionCategory[] };
    setCategories(d.categories ?? []);
  }, [countryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const fetchPage = useCallback(
    async (slug: string | null, page: number) => {
      const params = new URLSearchParams({ page: String(page), take: "12" });
      if (countryId) params.set("country", countryId);
      if (slug) params.set("category", slug);
      const res = await fetch(`/api/user/petitions?${params}`, { cache: "no-store" }).catch(
        () => null,
      );
      const d = (await res?.json().catch(() => ({}))) as { petitions?: PetitionCardDTO[] };
      return { items: d.petitions ?? [] };
    },
    [countryId],
  );

  return (
    <SiteShell viewer={viewer}>
      <PageHeading
        title={t("page.petitionsTitle", "Petitions")}
        intro={t("page.petitionsIntro", "Ask for something to change{country}, and see who else wants it.")}
        country={country?.name}
        actions={
          <Link
            href="/petitions/new"
            className="inline-flex h-10 shrink-0 items-center rounded-full bg-[color:var(--color-brand)] px-4 text-[13.5px] font-semibold text-[color:var(--color-on-brand)] transition-colors hover:bg-[color:var(--color-brand-hover)]"
          >
            {t("petitions.start", "Start a petition")}
          </Link>
        }
      />

      <CategoryBrowse
        kind="petitionCategory"
        categories={(categories ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          emoji: c.emoji,
          count: c.openCount,
        }))}
        label={t("petitions.categories", "Petition categories")}
        layout="space-y-3"
        fetchPage={fetchPage}
        renderItem={(p) => <PetitionCard key={p.id} petition={p} />}
        empty={(slug) => (
          <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center shadow-card">
            <p className="text-[15px] font-medium">
              {slug ? t("common.nothingHere", "Nothing here yet") : t("petitions.none", "No petitions yet")}
            </p>
            <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">
              {t("petitions.emptyBlurb", "If something near you needs to change, you can be the one who says so.")}
            </p>
            <Link
              href="/petitions/new"
              className="mt-4 inline-flex h-10 items-center rounded-full border border-[color:var(--color-border)] px-4 text-[13.5px] font-medium transition-colors hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)]"
            >
              {t("petitions.startFirst", "Start the first one")}
            </Link>
          </div>
        )}
      />
    </SiteShell>
  );
}
