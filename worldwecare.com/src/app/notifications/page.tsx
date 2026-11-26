import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { NotificationsClient } from "@/components/site/notifications-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.notifications.title", "Notifications"),
  };
}

export default async function NotificationsPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/notifications");
  return <NotificationsClient viewer={viewer} />;
}
