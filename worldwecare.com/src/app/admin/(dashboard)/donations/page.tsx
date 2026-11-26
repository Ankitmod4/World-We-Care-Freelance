import type { Metadata } from "next";
import { AdminDonationsClient } from "./client";

export const metadata: Metadata = { title: "Donations" };
export const dynamic = "force-dynamic";

export default function AdminDonationsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <AdminDonationsClient />
    </div>
  );
}
