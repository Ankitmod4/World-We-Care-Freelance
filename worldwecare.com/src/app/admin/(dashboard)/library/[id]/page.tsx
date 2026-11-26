import type { Metadata } from "next";
import { LibraryForm } from "../form";

export const metadata: Metadata = { title: "Edit theme" };

export default async function EditLibraryThemePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LibraryForm themeId={id} />;
}
