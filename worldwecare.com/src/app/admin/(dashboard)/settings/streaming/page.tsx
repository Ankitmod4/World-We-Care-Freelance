import type { Metadata } from "next";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { SettingsShell } from "@/components/admin/settings-shell";
import { StreamingPanel } from "./panel";

export const metadata: Metadata = { title: "Live streaming" };
export const dynamic = "force-dynamic";

export default async function StreamingSettingsPage() {
  const admin = await getCurrentAdmin();
  return (
    <SettingsShell
      title="Live streaming"
      subtitle="The MediaMTX server that carries one-to-one sessions, and whether this app can reach it."
    >
      <StreamingPanel canEdit={admin?.role !== "MODERATOR"} />
    </SettingsShell>
  );
}
