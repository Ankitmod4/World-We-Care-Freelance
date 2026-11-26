import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { getPlaceBySlug, parseHours, placeTypeLabel, recordPlaceView } from "@/lib/places";
import { readGallery } from "@/lib/attached-media";
import { PlaceDetailClient, type PlaceDetail } from "@/components/site/place-detail-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);
  return {
    title: place ? place.name : "Place",
    description: place?.summary ?? (place ? placeTypeLabel(place.type) : undefined),
  };
}

export default async function PlacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) redirect(`/login?next=/places/${slug}`);

  const place = await getPlaceBySlug(slug, viewer.id);
  if (!place) notFound();

  // Fire-and-forget, same as articles: a rough popularity signal, not
  // analytics, and never a reason to hold up the render.
  void recordPlaceView(place.id);

  // Hours and photos are both JSON columns; parse once here so the
  // client component gets shapes it can trust rather than casting.
  const payload = {
    ...place,
    hours: parseHours(place.hours),
    photos: readGallery(place.photos),
  } as unknown as PlaceDetail;
  return <PlaceDetailClient viewer={viewer} place={payload} />;
}
