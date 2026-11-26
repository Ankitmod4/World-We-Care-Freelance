import type { Metadata } from "next";
import { PlacesClient } from "./client";

export const metadata: Metadata = { title: "Places" };
export const dynamic = "force-dynamic";

export default function AdminPlacesPage() {
  return <PlacesClient />;
}
