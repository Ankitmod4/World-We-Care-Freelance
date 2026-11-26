import type { Metadata } from "next";
import { AdminEventsClient } from "./client";

export const metadata: Metadata = { title: "Events" };

export default function AdminEventsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <AdminEventsClient />
    </div>
  );
}
