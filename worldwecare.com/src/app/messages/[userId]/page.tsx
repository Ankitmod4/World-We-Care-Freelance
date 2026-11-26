import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { MessagesClient } from "@/components/site/messages-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.messages.userid.title", "Messages"),
  };
}

export default async function MessagesThreadPage({ params }: { params: Promise<{ userId: string }> }) {
  const viewer = await getCurrentUser();
  const { userId } = await params;
  if (!viewer) redirect(`/login?next=/messages/${userId}`);
  return <MessagesClient viewer={viewer} initialUserId={userId} />;
}
