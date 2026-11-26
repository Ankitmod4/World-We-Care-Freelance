import type { Metadata } from "next";
import { ArticleEditor } from "../editor";

export const metadata: Metadata = { title: "New article" };

export default function NewArticlePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ArticleEditor />
    </div>
  );
}
