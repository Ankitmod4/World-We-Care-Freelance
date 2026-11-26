import type { Metadata } from "next";
import { TranslationsClient } from "./client";

export const metadata: Metadata = { title: "Translations" };
export const dynamic = "force-dynamic";

export default function AdminTranslationsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <TranslationsClient />
    </div>
  );
}
