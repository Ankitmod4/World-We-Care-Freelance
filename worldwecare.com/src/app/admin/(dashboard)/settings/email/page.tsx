import type { Metadata } from "next";
import { getGroup } from "@/lib/settings";
import { SettingsShell } from "@/components/admin/settings-shell";
import { EmailForm } from "./form";

export const metadata: Metadata = { title: "Email settings" };

export default async function EmailSettingsPage() {
  const values = (await getGroup("email")) as Record<string, string | boolean>;
  // Never send the key back to the client — the client only needs to
  // know WHETHER one is set, not what it is.
  const hasKey = typeof values["email.resendApiKey"] === "string" && (values["email.resendApiKey"] as string).length > 0;
  const safeValues = { ...values, "email.resendApiKey": "" };

  return (
    <SettingsShell
      title="Email"
      subtitle="Delivery configuration. Set the API key, sender address, and turn delivery on."
    >
      <EmailForm initial={safeValues} hasKey={hasKey} />
    </SettingsShell>
  );
}
