import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { getClipPage, recordClipView } from "@/lib/library";
import { ClipDetailClient } from "@/components/site/clip-detail-client";

type Params = { params: Promise<{ slug: string; clipId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, clipId } = await params;
  const data = await getClipPage(slug, clipId);
  if (!data) return { title: "Library" };
  return {
    title: `${data.clip.title} · ${data.theme.name}`,
    description: data.clip.caption?.slice(0, 160) ?? data.theme.tagline ?? undefined,
  };
}

export default async function ClipPage({ params }: Params) {
  const { slug, clipId } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) redirect(`/login?next=/library/${slug}/${clipId}`);

  const data = await getClipPage(slug, clipId, viewer.id);
  if (!data) notFound();

  // The view counter that the modal never had anywhere sensible to
  // live. Not awaited: a slow write must not hold up the player.
  void recordClipView(data.clip.id);

  return (
    <ClipDetailClient
      viewer={viewer}
      theme={data.theme}
      clip={data.clip}
      prev={data.prev}
      next={data.next}
      position={data.position}
      total={data.total}
      more={data.more}
    />
  );
}
