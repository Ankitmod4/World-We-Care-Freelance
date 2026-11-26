import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { SavedClient } from "@/components/site/saved-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.saved.title", "Saved"),
  };
}

export default async function SavedPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/saved");
  return <SavedClient viewer={viewer} />;
}
