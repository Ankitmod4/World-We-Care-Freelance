import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { getBlockedIds } from "@/lib/blocks";
import { getGratitudeEntry } from "@/lib/gratitude";
import { GratitudeDetailClient } from "@/components/site/gratitude-detail-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.gratitude.id.title", "Gratitude"),
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) redirect(`/login?next=/gratitude/${id}`);

  const blocked = await getBlockedIds(viewer.id);
  const item = await getGratitudeEntry(id, viewer.id, blocked);
  // Not found and not-allowed-to-see are the same answer on purpose:
  // a 403 would confirm the thing exists.
  if (!item) notFound();

  return <GratitudeDetailClient viewer={viewer} item={item} />;
}
