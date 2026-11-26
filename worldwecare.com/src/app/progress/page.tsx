import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { ProgressClient } from "@/components/site/progress-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.progress.title", "Your progress"),
  };
}
export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/progress");
  return <ProgressClient viewer={viewer} />;
}
