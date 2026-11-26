import type { Metadata } from "next";
import { ArticleEditor } from "../editor";
import { getArticle } from "@/lib/articles-admin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticle(id);
  return { title: article ? article.title : "Article" };
}

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ArticleEditor articleId={id} />
    </div>
  );
}
