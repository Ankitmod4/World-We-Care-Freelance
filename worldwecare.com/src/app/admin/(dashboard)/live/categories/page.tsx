import type { Metadata } from "next";
import { AdminLiveCategoriesClient } from "./client";

export const metadata: Metadata = { title: "Live categories" };

export default function AdminLiveCategoriesPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <AdminLiveCategoriesClient />
    </div>
  );
}
