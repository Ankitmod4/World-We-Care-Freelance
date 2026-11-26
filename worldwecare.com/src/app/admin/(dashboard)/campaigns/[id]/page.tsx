import type { Metadata } from "next";
import { CampaignForm } from "../form";

export const metadata: Metadata = { title: "Edit campaign" };

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CampaignForm campaignId={id} />;
}
