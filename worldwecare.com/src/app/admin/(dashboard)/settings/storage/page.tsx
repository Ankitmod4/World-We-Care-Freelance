import type { Metadata } from "next";
import { getGroup } from "@/lib/settings";
import { BODY_LIMIT_MB } from "@/lib/upload-limits";
import { storageSummary } from "@/lib/media";
import { StorageUsage } from "./usage";
import { SettingsShell } from "@/components/admin/settings-shell";
import { StorageForm } from "./form";

export const metadata: Metadata = { title: "Storage settings" };

export default async function StorageSettingsPage() {
  const [values, usage] = await Promise.all([
    getGroup("storage") as Promise<Record<string, string | number>>,
    storageSummary(),
  ]);
  return (
    <SettingsShell
      title="Storage"
      subtitle="Where uploaded files live, how big they can be, and how long a video may run."
    >
      <StorageUsage usage={usage} />
      <StorageForm initial={values} bodyLimitMB={BODY_LIMIT_MB} />
    </SettingsShell>
  );
}
