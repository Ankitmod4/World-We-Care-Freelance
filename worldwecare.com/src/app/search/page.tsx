import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { SearchClient } from "@/components/site/search-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.search.title", "Search"),
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/search");
  const { q } = await searchParams;
  return <SearchClient viewer={viewer} initialQuery={q ?? ""} />;
}
