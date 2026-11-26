import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { PetitionsClient } from "@/components/site/petitions-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.petitions.title", "Petitions"),
  };
}

export default async function PetitionsPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/petitions");
  // Read here rather than in the client component so the header
  // never flashes the default copy before the real one arrives.
  return <PetitionsClient viewer={viewer} />;
}
