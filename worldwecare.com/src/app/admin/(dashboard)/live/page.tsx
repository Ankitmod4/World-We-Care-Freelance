import type { Metadata } from "next";
import { LiveAdmin } from "./client";

export const metadata: Metadata = { title: "Live" };
export const dynamic = "force-dynamic";

export default function AdminLivePage() {
  return <LiveAdmin />;
}
