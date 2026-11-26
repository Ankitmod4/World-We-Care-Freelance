import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { PlacesClient } from "@/components/site/places-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.places.title", "Places"),
  };
}

export default async function PlacesPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/places");
  // Read here rather than in the client component so the header
  // never flashes the default copy before the real one arrives.
  return <PlacesClient viewer={viewer} />;
}
