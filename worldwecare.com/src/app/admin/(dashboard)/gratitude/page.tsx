import type { Metadata } from "next";
import { GratitudeAdminClient } from "./client";

export const metadata: Metadata = { title: "Gratitude wall" };

export default function GratitudeAdminPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <GratitudeAdminClient />
    </div>
  );
}
