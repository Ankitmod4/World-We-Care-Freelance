import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { EventsDirectory } from "@/components/site/events-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.events.title", "Events"),
  };
}

export default async function EventsPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/events");
  // Read here rather than in the client component so the header
  // never flashes the default copy before the real one arrives.
  return <EventsDirectory viewer={viewer} />;
}
