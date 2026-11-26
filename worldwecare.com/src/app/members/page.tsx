import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { MembersClient } from "@/components/site/members-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.members.title", "Members"),
  };
}

export default async function MembersPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/members");
  return <MembersClient viewer={viewer} />;
}
