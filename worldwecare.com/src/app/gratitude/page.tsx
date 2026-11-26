import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { listCategoryTiles } from "@/lib/post-categories";
import { GratitudeClient } from "@/components/site/gratitude-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.gratitude.title", "Gratitude"),
  };
}

export default async function GratitudePage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/gratitude");
  // Read here rather than in the client component so the strip's
  // counts are right in the first paint.
  const categories = await listCategoryTiles("gratitude");
  return (
    <GratitudeClient
      viewer={viewer}
      // Data, not a node: the strip sets the wall's filter, so it has
      // to be rendered by the component that owns that state.
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        emoji: c.emoji,
        count: c.count,
      }))}
    />
  );
}
