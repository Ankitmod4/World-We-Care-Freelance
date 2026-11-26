import type { Metadata } from "next";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { SettingsShell } from "@/components/admin/settings-shell";
import { PaymentsPanel } from "./panel";

export const metadata: Metadata = { title: "Stripe" };
export const dynamic = "force-dynamic";

export default async function PaymentsSettingsPage() {
  const admin = await getCurrentAdmin();
  return (
    <SettingsShell
      title="Stripe"
      subtitle="The account donations are collected into, and what a donation may be."
    >
      <PaymentsPanel canEdit={admin?.role === "OWNER"} />
    </SettingsShell>
  );
}
