"use client";

/**
 * /articles — the sections, as tabs.
 *
 * This page has now been three things. It was a paginated list with a
 * category dropdown; then a grid of tiles, on the argument that the
 * first thing you want from a library is a map of it; now a tab strip
 * over that same list.
 *
 * The tiles' problem was that they were a whole screen of doors before
 * a single article. A strip answers the same question in one row, and
 * what a reader came for starts immediately underneath. The map is
 * still there — twelve named sections with counts — it just stopped
 * being the page.
 *
 * `CategoryBrowse` owns the strip, the paging and the reset-on-switch.
 * What is here is what is specific to articles: the endpoint, the
 * card, and the fact that an empty section is a prompt to write rather
 * than an error.
 */

import { useCallback } from "react";
import Link from "next/link";
import { CategoryBrowse } from "./category-browse";
import { ArticleCard } from "./article-card";
import type { TabCategory } from "./category-tabs";
import { useT } from "./locale-context";

interface FeedArticle {
  id: string;
  slug: string;
  title: string;
  [k: string]: unknown;
}

export function ArticlesBrowseClient({ categories }: { categories: TabCategory[] }) {
  const t = useT();
  const fetchPage = useCallback(async (slug: string | null, page: number) => {
    const params = new URLSearchParams({ page: String(page), perPage: "12" });
    if (slug) params.set("category", slug);
    const res = await fetch(`/api/user/articles?${params}`, { cache: "no-store" });
    const d = (await res.json().catch(() => ({}))) as {
      articles?: FeedArticle[];
      page?: number;
      pageCount?: number;
    };
    return {
      items: d.articles ?? [],
      // The endpoint knows the page count, so "is there more" is a
      // fact rather than the usual "we got a full page, probably".
      hasMore: (d.page ?? page) < (d.pageCount ?? 1),
    };
  }, []);

  return (
    <CategoryBrowse
      kind="articleCategory"
      categories={categories}
      label={t("articles.sections", "Article sections")}
      layout="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      fetchPage={fetchPage}
      renderItem={(a) => <ArticleCard key={a.id} article={a as never} />}
      empty={(slug) => (
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center shadow-card">
          <p className="text-[15px] font-medium">
            {slug ? t("articles.noneInSection", "Nothing in this section yet") : t("articles.none", "No articles yet")}
          </p>
          <p className="mx-auto mt-1 max-w-[46ch] text-[13.5px] text-[color:var(--color-text-muted)]">
            {slug
              ? t(
                  "articles.tryAnotherSection",
                  "Try another section \u2014 there is writing in the others.",
                )
              : t("articles.emptyBlurb", "When the team publishes something, it will appear here.")}
          </p>
          {slug && (
            <Link
              href="/articles"
              className="mt-4 inline-flex h-10 items-center rounded-full border border-[color:var(--color-border)] px-4 text-[13.5px] font-medium transition-colors hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)]"
            >
              {t("common.seeEverything", "See everything")}
            </Link>
          )}
        </div>
      )}
    />
  );
}
