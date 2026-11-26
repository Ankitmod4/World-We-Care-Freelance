import type { Metadata } from "next";
import { listAdminLibraryThemes } from "@/lib/library-admin";
import { LibraryList } from "./list";

export const metadata: Metadata = { title: "Library" };
export const dynamic = "force-dynamic";

export default async function AdminLibraryPage() {
  return <LibraryList initial={await listAdminLibraryThemes()} />;
}
