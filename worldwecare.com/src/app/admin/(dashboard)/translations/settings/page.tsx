import type { Metadata } from "next";
import { TranslationSettingsClient } from "./client";

export const metadata: Metadata = { title: "Translation settings" };
export const dynamic = "force-dynamic";

export default function AdminTranslationSettingsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <TranslationSettingsClient />
    </div>
  );
}
