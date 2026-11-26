import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { listPublicHeroCategories } from "@/lib/town-hero-categories";
import { TownHeroesClient } from "@/components/site/town-heroes-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.town.heroes.title", "Town Heroes"),
  };
}

/**
 * Signed in only, unlike Articles and Live.
 *
 * These are real named people who did not ask to be written about, and
 * the nominations are unverified until a moderator reads them. Putting
 * that behind an account is the least we can do — it means anything
 * that goes wrong has a member's name attached to it.
 */
export default async function TownHeroesPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/town-heroes");
  const categories = await listPublicHeroCategories();
  return <TownHeroesClient viewer={viewer} categories={categories} />;
}
