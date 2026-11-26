import type { Metadata } from "next";
import { AdminArticlesClient } from "./client";

export const metadata: Metadata = { title: "Articles" };

export default function AdminArticlesPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <AdminArticlesClient />
    </div>
  );
}
