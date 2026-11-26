import { redirect } from "next/navigation";

/**
 * /admin/settings has no page of its own — it's a sub-tree. Bounce
 * to the first tab so a bare URL doesn't 404.
 */
export default function SettingsIndex() {
  redirect("/admin/settings/general");
}
