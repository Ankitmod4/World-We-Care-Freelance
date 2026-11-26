import type { Metadata } from "next";
import { AdminEventCategoriesClient } from "./client";

export const metadata: Metadata = { title: "Event categories" };

export default function AdminEventCategoriesPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <AdminEventCategoriesClient />
    </div>
  );
}
