 import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import {
  getPublishedArticle,
  listArticleComments,
  listRelatedArticles,
  recordArticleView,
} from "@/lib/articles";
import { Markdown } from "@/lib/rich-text";
import { readGallery } from "@/lib/attached-media";
import { PhotoGallery } from "@/components/site/photo-gallery";
import { toEmbed } from "@/lib/embeds";
import { SiteShell } from "@/components/site/site-shell";
import { SiteHeader } from "@/components/site/site-header";
import { ArticleEngagement } from "@/components/site/article-engagement";
import { ArticleCard } from "@/components/site/article-card";
import { Img } from "@/components/ui/img";
import { getT } from "@/lib/i18n";
import { TranslatedContent } from "@/components/site/translated-content";
import { TranslatedMarkdown } from "@/components/site/translated-markdown";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) return { title: "Article" };
  return {
    title: article.title,
    description: article.excerpt ?? undefined,
    openGraph: {
      title: article.title,
      description: article.excerpt ?? undefined,
      images: article.coverUrl ? [article.coverUrl] : undefined,
      type: "article",
    },
  };
}

export default async function ArticleReaderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const t = await getT();
  const { slug } = await params;
  const viewer = await getCurrentUser();
  const article = await getPublishedArticle(slug, viewer?.id ?? null);
  if (!article) notFound();

  const [comments, related] = await Promise.all([
    listArticleComments(article.id, viewer?.id ?? null),
    listRelatedArticles(article.id, article.category?.id ?? null, 3),
  ]);

  // Fire-and-forget: a rough popularity signal, not analytics.
  void recordArticleView(article.id);

  const embed = toEmbed(article.videoUrl);
  const published = article.publishedAt ? new Date(article.publishedAt) : null;

  const body = (
    <article className="p-4 sm:p-6 lg:p-8">
      {/* Long-form text is the one place DESIGN_RULES allows a width
          cap — a 65–75ch measure is what makes prose readable. */}
      <div className="mx-auto w-full max-w-[72ch]">
        <nav className="mb-4">
          <Link
            href="/articles"
            className="text-[13px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)]"
          >
            ← All articles
          </Link>
        </nav>

        {article.category && (
          <Link
            href={`/articles?category=${article.category.slug}`}
            className="text-[12px] font-semibold uppercase tracking-wide text-[color:var(--color-brand)] hover:underline"
          >
            <TranslatedContent
              kind="articleCategory"
              id={article.category.id}
              field="name"
              text={article.category.name}
              toggle={false}
            />
          </Link>
        )}

        <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[38px]">
          <TranslatedContent kind="article" id={article.id} field="title" text={article.title} toggle={false} />
        </h1>

        {article.excerpt && (
          <p className="mt-3 text-[17px] leading-relaxed text-[color:var(--color-text-muted)]">
            <TranslatedContent kind="article" id={article.id} field="excerpt" text={article.excerpt} toggle={false} />
          </p>
        )}

        <p className="mt-4 text-[13px] tabular-nums text-[color:var(--color-text-subtle)]">
          {article.authorNameSnapshot}
          {published && ` · ${published.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`}
          {" \u00b7 " + t("articles.readMinutes", "{n} min read", { n: article.readMinutes })}
        </p>
      </div>

      {article.coverUrl && (
        <div className="mx-auto mt-6 w-full max-w-[80ch] overflow-hidden rounded-2xl shadow-card">
          <Img
            src={article.coverUrl}
            alt={article.coverAlt ?? ""}
            className="h-auto w-full object-cover"
          />
        </div>
      )}

      {embed && (
        <div className="mx-auto mt-6 w-full max-w-[80ch] overflow-hidden rounded-2xl shadow-card">
          <div className="relative aspect-video w-full bg-black">
            <iframe
              src={embed.src}
              title={article.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>
      )}

      <div className="mx-auto mt-8 w-full max-w-[72ch]">
        <TranslatedMarkdown kind="article" id={article.id} text={article.body} />

        {/*
          AFTER THE WRITING, BEFORE THE ENGAGEMENT ROW. These are the
          photographs that go with the piece, not the ones inside it —
          images placed in the Markdown stay where the author put them.
          A JSON column, so it is read defensively into the gallery's
          shape rather than cast and hoped for.

          The same PhotoGallery campaigns, places, petitions and events
          use, so all five size their thumbnails to the column and open
          the same lightbox.
        */}
        {(() => {
          const photos = readGallery(article.photos);
          return photos.length > 0 ? (
            <section className="mt-8">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
                {t("common.photos", "Photos")}
              </h2>
              <PhotoGallery photos={photos} />
            </section>
          ) : null;
        })()}

        <ArticleEngagement
          articleId={article.id}
          slug={article.slug}
          viewer={viewer ? { id: viewer.id, displayName: viewer.displayName } : null}
          initialLiked={article.liked}
          initialMyReaction={article.myReaction}
          initialLikeCount={article.likeCount}
          initialSaved={article.saved}
          initialComments={comments.map((c) => ({
            ...c,
            createdAt: c.createdAt.toISOString(),
          }))}
        />

      </div>

      {/* "More like this" sits OUTSIDE the 72ch prose column on purpose.
          Inside it, three cards would be ~200px wide and the covers
          unreadable — and DESIGN_RULES rule 1 only exempts long-form
          text from full width, not a card grid. */}
      {related.length > 0 && (
        <section className="mt-12 border-t border-[color:var(--color-border-soft)] pt-8">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em]">
            {t("articleDetail.moreLikeThis", "More like this")}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <ArticleCard key={r.id} article={r} />
            ))}
          </div>
        </section>
      )}
    </article>
  );

  if (!viewer) {
    return (
      <>
        <SiteHeader user={null} />
        <main className="w-full">{body}</main>
      </>
    );
  }
  return <SiteShell viewer={viewer}>{body}</SiteShell>;
}
