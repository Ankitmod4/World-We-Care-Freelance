import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { listPublicCategories } from "@/lib/campaign-categories";
import { CampaignNewClient } from "@/components/site/campaign-new-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.campaigns.new.title", "Start a campaign"),
  };
}

export default async function NewCampaignPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/campaigns/new");
  // Read here rather than in the client component: the category is a
  // required field, and options that arrive after the form does can
  // be scrolled past before they exist.
  const categories = await listPublicCategories();
  return <CampaignNewClient viewer={viewer} categories={categories} />;
}
