import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { getMediamtxConfig } from "@/lib/mediamtx";
import { whyNotAllowed } from "@/lib/live-streams";
import { SiteShell } from "@/components/site/site-shell";
import { NewStream } from "@/components/site/live-clients";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.live.new.title", "Go live"),
  };
}
export const dynamic = "force-dynamic";

export default async function NewStreamPage() {
  const t = await getT();
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login?next=/live/new");

  // Checked here as well as in the API: someone who can't stream
  // should be told before they fill in a form, not after.
  const blocked = await whyNotAllowed(viewer.id);
  const c = await getMediamtxConfig();

  return (
    <SiteShell viewer={viewer}>
      <div className="p-4 sm:p-6 lg:p-8">
        {blocked ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-8 text-center shadow-card">
            <p className="text-[15px] font-medium">{t("live.blocked", "You can\u2019t go live right now")}</p>
            <p className="mx-auto mt-1.5 max-w-[46ch] text-[13.5px] text-[color:var(--color-text-muted)]">
              {blocked}
            </p>
          </div>
        ) : (
          <NewStream defaultVisibility={c.defaultVisibility} />
        )}
      </div>
    </SiteShell>
  );
}
