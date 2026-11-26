import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { EventNewClient } from "@/components/site/event-new-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.events.new.title", "Submit an event"),
  };
}

export default async function NewEventPage() {
  const viewer = await getCurrentUser();
  // `next` so signing in lands back on the form rather than the
  // calendar, which is the whole advantage of this being a URL.
  if (!viewer) redirect("/login?next=/events/new");
  return <EventNewClient viewer={viewer} />;
}
