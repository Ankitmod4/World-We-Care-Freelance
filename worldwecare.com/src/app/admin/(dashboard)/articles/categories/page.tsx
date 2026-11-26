import type { Metadata } from "next";
import { AdminArticleCategoriesClient } from "./client";

export const metadata: Metadata = { title: "Article categories" };

export default function AdminArticleCategoriesPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <AdminArticleCategoriesClient />
    </div>
  );
}
