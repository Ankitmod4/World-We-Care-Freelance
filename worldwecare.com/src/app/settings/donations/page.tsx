import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { SiteShell } from "@/components/site/site-shell";
import { DonationHistory } from "@/components/site/donation-clients";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.settings.donations.title", "Donations"),
  };
}
export const dynamic = "force-dynamic";

export default async function DonationsPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/settings/donations");
  return (
    <SiteShell viewer={viewer}>
      <div className="p-4 sm:p-6 lg:p-8">
        <DonationHistory />
      </div>
    </SiteShell>
  );
}
