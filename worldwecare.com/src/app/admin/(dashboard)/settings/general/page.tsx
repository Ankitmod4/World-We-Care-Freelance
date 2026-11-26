import type { Metadata } from "next";
import { getGroup } from "@/lib/settings";
import { SettingsShell } from "@/components/admin/settings-shell";
import { GeneralForm } from "./form";

export const metadata: Metadata = { title: "General settings" };

export default async function GeneralSettingsPage() {
  const values = (await getGroup("general")) as Record<string, string>;
  return (
    <SettingsShell
      title="General"
      subtitle="Branding, site metadata, and the identity your community sees."
    >
      <GeneralForm initial={values} />
    </SettingsShell>
  );
}
