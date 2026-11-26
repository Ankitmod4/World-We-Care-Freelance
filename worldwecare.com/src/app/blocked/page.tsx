import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { BlockedClient } from "@/components/site/blocked-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.blocked.title", "Blocked accounts"),
  };
}

export default async function BlockedPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/blocked");
  return <BlockedClient viewer={viewer} />;
}
