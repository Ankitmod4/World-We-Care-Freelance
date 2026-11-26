import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/user-auth";
import { whyNotAllowed } from "@/lib/live-streams";
import { listPublicCategories } from "@/lib/live-categories";
import { SiteShell } from "@/components/site/site-shell";
import { SiteHeader } from "@/components/site/site-header";
import { LiveCategories } from "@/components/site/live-clients";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.live.title", "Live"),
  };
}
export const dynamic = "force-dynamic";

/**
 * The category directory. Pick a category, then pick a broadcast.
 *
 * Readable signed out, like Articles: the plan's first rung is someone
 * quietly watching before they are ready to take part, and a live list
 * behind a login hides the platform from exactly that person.
 *
 * Counts are resolved on the server so the tiles are right on first
 * paint rather than all reading "Nobody live" for a beat.
 */
export default async function LivePage() {
  const viewer = await getCurrentUser();
  const [categories, blockedReason] = await Promise.all([
    listPublicCategories(),
    viewer ? whyNotAllowed(viewer.id) : Promise.resolve(null),
    // Read on the server, like every other page's banner, so the
    // header never paints the built-in copy and then swap to the
    // admin's.
  ]);

  const body = (
    <div className="p-4 sm:p-6 lg:p-8">
      <LiveCategories
        initial={categories}
        signedIn={!!viewer}
        blockedReason={blockedReason}
      />
    </div>
  );

  if (!viewer) {
    return (
      <>
        <SiteHeader user={null} />
        <main className="mx-auto w-full">{body}</main>
      </>
    );
  }
  return <SiteShell viewer={viewer}>{body}</SiteShell>;
}
