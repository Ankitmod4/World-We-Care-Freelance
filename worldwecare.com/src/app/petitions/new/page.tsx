import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { listPublicCategories } from "@/lib/petition-categories";
import { PetitionNewClient } from "@/components/site/petition-new-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.petitions.new.title", "Start a petition"),
  };
}

export default async function NewPetitionPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/petitions/new");
  // Read here rather than in the client component: the category is a
  // required field, and options that arrive after the form does can
  // be scrolled past before they exist.
  const categories = await listPublicCategories();
  return <PetitionNewClient viewer={viewer} categories={categories} />;
}
