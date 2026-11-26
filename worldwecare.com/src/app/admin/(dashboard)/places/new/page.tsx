import type { Metadata } from "next";
import { PlaceForm } from "../form";

export const metadata: Metadata = { title: "New place" };

export default function NewPlacePage() {
  return <PlaceForm />;
}
