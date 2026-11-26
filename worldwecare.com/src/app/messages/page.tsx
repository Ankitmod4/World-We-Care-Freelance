import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { MessagesClient } from "@/components/site/messages-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.messages.title", "Messages"),
  };
}

export default async function MessagesPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/messages");
  return <MessagesClient viewer={viewer} initialUserId={null} />;
}
