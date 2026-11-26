import type { Metadata } from "next";
import { CampaignForm } from "../form";

export const metadata: Metadata = { title: "New campaign" };

export default function NewCampaignPage() {
  return <CampaignForm />;
}
