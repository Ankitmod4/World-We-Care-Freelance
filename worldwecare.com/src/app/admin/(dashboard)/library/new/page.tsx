import type { Metadata } from "next";
import { LibraryForm } from "../form";

export const metadata: Metadata = { title: "New theme" };

export default function NewLibraryThemePage() {
  return <LibraryForm />;
}
