import type { Metadata } from "next";
import { getGroup } from "@/lib/settings";
import { SettingsShell } from "@/components/admin/settings-shell";
import { CacheClient } from "./client";

export const metadata: Metadata = { title: "Cache settings" };

export default async function CacheSettingsPage() {
  const values = (await getGroup("cache")) as Record<
    string,
    boolean | number
  >;
  return (
    <SettingsShell
      title="Cache"
      subtitle="In-process caches used by the app. Purge to force a refresh from the database."
    >
      <CacheClient
        initialEnabled={Boolean(values["cache.enabled"] ?? true)}
        initialTtl={Number(values["cache.defaultTtlSeconds"] ?? 300)}
      />
    </SettingsShell>
  );
}
