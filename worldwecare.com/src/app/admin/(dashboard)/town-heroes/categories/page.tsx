import type { Metadata } from "next";
import { HeroCategoriesClient } from "./client";

export const metadata: Metadata = { title: "Town Hero categories" };

export default function HeroCategoriesPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <HeroCategoriesClient />
    </div>
  );
}
