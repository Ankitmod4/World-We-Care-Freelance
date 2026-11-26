import type { Metadata } from "next";
import { TownHeroesAdminClient } from "./client";

export const metadata: Metadata = { title: "Town Heroes" };

export default function TownHeroesAdminPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <TownHeroesAdminClient />
    </div>
  );
}
