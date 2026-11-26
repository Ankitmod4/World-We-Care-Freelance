import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { getLibraryThemeBySlug } from "@/lib/library";
import { LibraryDetailClient } from "@/components/site/library-detail-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const theme = await getLibraryThemeBySlug(slug);
  return { title: theme ? theme.name : "Library" };
}

export default async function LibraryThemePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) redirect(`/login?next=/library/${slug}`);

  const theme = await getLibraryThemeBySlug(slug, viewer.id);
  if (!theme) notFound();

  return <LibraryDetailClient viewer={viewer} theme={theme} />;
}
