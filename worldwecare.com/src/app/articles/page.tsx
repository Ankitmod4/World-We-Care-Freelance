import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/user-auth";
import { listCategoryTiles } from "@/lib/articles";
import { SiteShell } from "@/components/site/site-shell";
import { SiteHeader } from "@/components/site/site-header";
import { ArticlesBrowseClient } from "@/components/site/articles-browse-client";
import { PageHeading } from "@/components/site/page-heading";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.articles.title", "Articles"),
  };
}

/**
 * /articles — the sections, as tabs over the stream.
 *
 * This page has been a paginated list with a dropdown, then a grid of
 * tiles, and is now a tab strip over the list. The tiles answered a
 * real question — what is in this library — but spent a whole screen
 * doing it before showing a single article. The strip answers it in
 * one row.
 *
 * NO "JUST PUBLISHED" STRIP ANY MORE. It existed because the tile
 * version had no list at all, so the newest few were the only way to
 * reach an article without first picking a section. The tab strip
 * opens on "All", newest first — which is the same three articles,
 * in the same order, without a second copy of them sitting above.
 *
 * CATEGORIES ARE READ ON THE SERVER and handed down: they are the
 * page's primary control, and a control that appears a moment after
 * the page does can be scrolled past before it exists.
 */
export default async function ArticlesPage() {
  const viewer = await getCurrentUser();
  const categories = await listCategoryTiles();
  // The one server-rendered page of the set, so the strings come from
  // `getT` rather than `useT`. `PageHeading` takes them already
  // translated, which is why it works from both.
  const t = await getT();

  const body = (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeading
        title={t("page.articlesTitle", "Articles")}
        intro={t("page.articlesIntro", "Stories, guidance and reporting from the community.")}
      />

      <section>
        {/* The heading lives in CategoryTabs now, so every section has
            the same one in the same place. */}
        <ArticlesBrowseClient
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            emoji: c.emoji,
            count: c.count,
          }))}
        />
      </section>
    </div>
  );

  if (!viewer) {
    return (
      <>
        <SiteHeader user={null} />
        <main className="mx-auto w-full">{body}</main>
      </>
    );
  }
  return <SiteShell viewer={viewer}>{body}</SiteShell>;
}
