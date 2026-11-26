import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { getPetitionBySlug, listSignatures } from "@/lib/petitions";
import { PetitionDetailClient } from "@/components/site/petition-detail-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPetitionBySlug(slug);
  if (!p) return { title: "Petition" };
  return { title: p.title, description: p.summary ?? undefined };
}

export default async function PetitionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) redirect(`/login?next=/petitions/${slug}`);

  const petition = await getPetitionBySlug(slug, viewer.id);
  if (!petition) notFound();

  const signatures = await listSignatures(petition.id);

  return (
    <PetitionDetailClient
      viewer={viewer}
      initial={petition}
      initialSignatures={signatures}
    />
  );
}
