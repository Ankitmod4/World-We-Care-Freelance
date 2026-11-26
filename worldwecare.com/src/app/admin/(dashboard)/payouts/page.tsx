import type { Metadata } from "next";
import { AdminPayoutsClient } from "./client";

export const metadata: Metadata = { title: "Payouts" };
export const dynamic = "force-dynamic";

export default function AdminPayoutsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <AdminPayoutsClient />
    </div>
  );
}
