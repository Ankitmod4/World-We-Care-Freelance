import type { Metadata } from "next";
import { AdminChatCategoriesClient } from "./client";

export const metadata: Metadata = { title: "Chat categories" };

export default function AdminChatCategoriesPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <AdminChatCategoriesClient />
    </div>
  );
}
