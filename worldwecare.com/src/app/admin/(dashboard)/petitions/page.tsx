import type { Metadata } from "next";
import { AdminPetitionsClient } from "./client";

export const metadata: Metadata = { title: "Petitions" };

export default function AdminPetitionsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <AdminPetitionsClient />
    </div>
  );
}
