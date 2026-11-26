import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { SettingsClient } from "@/components/site/settings-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.settings.title", "Settings"),
  };
}

export default async function SettingsPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/settings");
  return <SettingsClient viewer={viewer} />;
}
