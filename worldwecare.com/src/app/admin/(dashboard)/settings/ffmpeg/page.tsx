import type { Metadata } from "next";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { SettingsShell } from "@/components/admin/settings-shell";
import { FfmpegPanel } from "./panel";

export const metadata: Metadata = { title: "Media / ffmpeg" };
export const dynamic = "force-dynamic";

export default async function FfmpegSettingsPage() {
  const admin = await getCurrentAdmin();
  return (
    <SettingsShell
      title="Media / ffmpeg"
      subtitle="Whether this server can turn an uploaded video into something every browser can play."
    >
      <FfmpegPanel canInstall={admin?.role === "OWNER"} />
    </SettingsShell>
  );
}
