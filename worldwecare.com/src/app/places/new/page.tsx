import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { PlaceNewClient } from "@/components/site/place-new-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.places.new.title", "Add a place"),
  };
}

export default async function NewPlacePage() {
  const viewer = await getCurrentUser();
  // `next` so signing in lands back on the form rather than the map,
  // which is the whole advantage of this being a URL at all.
  if (!viewer) redirect("/login?next=/places/new");
  return <PlaceNewClient viewer={viewer} />;
}
