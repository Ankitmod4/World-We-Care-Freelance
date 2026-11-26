import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { listOwnSubmittedCampaigns } from "@/lib/campaigns";
import { CampaignsClient } from "@/components/site/campaigns-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.campaigns.title", "Campaigns"),
  };
}

export default async function CampaignsPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/campaigns");
  // On the server, so the header never flashes the default copy.

  // The member's own submissions, so one that is still in review has
  // somewhere to be found. Without this, submitting means being
  // redirected to a page you can never navigate back to: the campaign
  // is not on the public list yet, and nothing else links to it.
  const mine = (await listOwnSubmittedCampaigns(viewer.id))
    .filter((c) => c.status === "PENDING" || c.status === "REJECTED")
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      status: c.status as "PENDING" | "REJECTED",
    }));

  return <CampaignsClient viewer={viewer} mine={mine} />;
}
