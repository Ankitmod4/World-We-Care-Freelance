import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { listPublicHeroCategories } from "@/lib/town-hero-categories";
import { NominateHeroForm } from "@/components/site/nominate-hero-form";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.town.heroes.new.title", "Nominate a hero"),
  };
}
export const dynamic = "force-dynamic";

export default async function NominateHeroPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/town-heroes/new");
  // Read on the server so the category picker is populated on first
  // paint rather than appearing a beat after the rest of the form.
  const categories = await listPublicHeroCategories();
  return <NominateHeroForm viewer={viewer} categories={categories} />;
}
