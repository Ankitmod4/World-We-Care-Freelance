import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { getTodayReflection } from "@/lib/daily-reflection";
import { JournalClient } from "@/components/site/journal-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.journal.title", "Your journal"),
  };
}
export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/journal");
  // The question is a prompt, not a requirement — the composer works
  // with or without one.
  const today = await getTodayReflection(viewer.id);
  return (
    <JournalClient
      viewer={viewer}
      todayQuestion={today.question ? { id: today.question.id, body: today.question.body } : null}
    />
  );
}
