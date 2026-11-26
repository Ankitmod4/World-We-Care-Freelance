import type { Metadata } from "next";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { SettingsShell } from "@/components/admin/settings-shell";
import { PayoutSettingsPanel } from "./panel";

export const metadata: Metadata = { title: "Payouts" };
export const dynamic = "force-dynamic";

export default async function PayoutSettingsPage() {
  const admin = await getCurrentAdmin();
  return (
    <SettingsShell
      title="Payouts"
      subtitle="What WorldWeCare keeps, how long money is held, and how members can be paid."
    >
      <PayoutSettingsPanel canEdit={admin?.role === "OWNER"} />
    </SettingsShell>
  );
}
