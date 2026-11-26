import type { Metadata } from "next";
import { BannedWordsClient } from "./client";

export const metadata: Metadata = { title: "Banned words" };

export default function BannedWordsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <BannedWordsClient />
    </div>
  );
}
