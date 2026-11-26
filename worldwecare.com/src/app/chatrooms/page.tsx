import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { ChatBrowse } from "@/components/site/chat-browse";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.chatrooms.title", "Chatrooms"),
  };
}

export default async function ChatroomsPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/chatrooms");
  // Read here rather than in the client component so the header
  // never flashes the default copy before the real one arrives.
  return <ChatBrowse viewer={viewer} />;
}
