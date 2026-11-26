import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { ProfileClient } from "@/components/site/profile-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.profile.title", "Profile"),
  };
}

export default async function ProfilePage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/profile");
  return <ProfileClient viewer={viewer} />;
}
