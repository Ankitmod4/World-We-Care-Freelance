import type { Metadata } from "next";
import { PlaceForm } from "../form";

export const metadata: Metadata = { title: "Edit place" };

export default async function EditPlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PlaceForm placeId={id} />;
}
