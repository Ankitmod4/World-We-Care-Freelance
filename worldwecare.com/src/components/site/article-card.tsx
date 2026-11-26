"use client";

/**
 * One article tile — shared by the magazine index and the Saved page so
 * the two can't drift apart.
 *
 * Every text block has a FIXED height expressed in `em` (so it scales
 * with its own font size): one line for the category, two for the
 * title, two for the excerpt. Each renders unconditionally, with a
 * non-breaking space standing in when a field is missing — that's what
 * keeps the read-time row on the same baseline across the whole grid,
 * not merely within a row (CSS grid only equalises rows, not the gaps
 * between them).
 */

import Link from "next/link";
import { Img } from "@/components/ui/img";
import { TranslatedContent } from "./translated-content";
import { useT } from "./locale-context";

export interface ArticleCardData {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  coverAlt: string | null;
  readMinutes: number;
  commentCount: number;
  category: { id: string; name: string; slug: string } | null;
}

export function ArticleCard({ article: a }: { article: ArticleCardData }) {
  const t = useT();
  return (
    <Link
      href={`/articles/${a.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card transition-shadow duration-200 hover:shadow-elevated"
    >
      <div className="aspect-[16/10] w-full overflow-hidden bg-[color:var(--color-surface-muted)]">
        {a.coverUrl ? (
          <Img
            src={a.coverUrl}
            alt={a.coverAlt ?? ""}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[12px] text-[color:var(--color-text-subtle)]">
            {a.category ? (
              <TranslatedContent
                kind="articleCategory"
                id={a.category.id}
                field="name"
                text={a.category.name}
                toggle={false}
              />
            ) : (
              t("articles.one", "Article")
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <span className="mb-1.5 block h-[1.4em] truncate text-[11.5px] font-semibold uppercase leading-[1.4] tracking-wide text-[color:var(--color-brand)]">
          {a.category ? (
            <TranslatedContent
              kind="articleCategory"
              id={a.category.id}
              field="name"
              text={a.category.name}
              toggle={false}
            />
          ) : (
            " "
          )}
        </span>
        <h2 className="line-clamp-2 h-[2.75em] text-[16px] font-semibold leading-[1.375] tracking-[-0.01em]">
          <TranslatedContent kind="article" id={a.id} field="title" text={a.title} toggle={false} />
        </h2>
        <p className="mt-1.5 line-clamp-2 h-[3em] text-[13.5px] leading-[1.5] text-[color:var(--color-text-muted)]">
          {a.excerpt ? (
            <TranslatedContent
              kind="article"
              id={a.id}
              field="excerpt"
              text={a.excerpt}
              toggle={false}
            />
          ) : (
            " "
          )}
        </p>
        <p className="mt-auto pt-3 text-[11.5px] tabular-nums text-[color:var(--color-text-subtle)]">
          {t("articles.readMinutes", "{n} min read", { n: a.readMinutes })}
          {a.commentCount > 0 &&
            " \u00b7 " +
              (a.commentCount === 1
                ? t("articles.oneComment", "1 comment")
                : t("articles.nComments", "{n} comments", { n: a.commentCount }))}
        </p>
      </div>
    </Link>
  );
}
