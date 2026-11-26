import type { Metadata } from "next";
import { GeographyClient } from "./client";

export const metadata: Metadata = { title: "Geography" };

export default function GeographyPage() {
  return <GeographyClient />;
}
